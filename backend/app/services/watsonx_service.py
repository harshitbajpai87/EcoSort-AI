"""
backend/app/services/watsonx_service.py
=========================================
EcoSort AI — conversational assistant backed by IBM watsonx.ai.

Two-tier strategy
-----------------
1. **watsonx.ai** (primary): uses ibm-watsonx-ai SDK with IBM Granite 13B Chat.
   Activated when both IBM_WATSONX_APIKEY and IBM_WATSONX_PROJECT_ID are set
   and the endpoint is reachable.

2. **Local rule-based fallback** (automatic): a keyword-driven expert system
   covering waste segregation, recycling, composting, hazardous disposal, and
   eco-points. Engages silently whenever credentials are absent or the API
   call fails — the app never crashes or returns an error to the user.

The caller only ever calls  ask(message)  and receives a ChatResponse.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class ChatResponse:
    answer: str
    source: str   # "watsonx.ai"  |  "Local Fallback"


# ---------------------------------------------------------------------------
# 2. watsonx.ai client  (lazy-initialised once)
# ---------------------------------------------------------------------------

_wx_client = None          # ibm_watsonx_ai ModelInference instance
_wx_ready: bool | None = None  # None = not yet tried; True/False after attempt


def _try_init_watsonx() -> bool:
    """
    Attempt to initialise the watsonx.ai model client.
    Returns True if successful, False otherwise.
    Sets the module-level _wx_client and _wx_ready.
    """
    global _wx_client, _wx_ready

    if _wx_ready is not None:
        return _wx_ready  # already attempted

    api_key = os.environ.get("IBM_WATSONX_APIKEY", "").strip()
    project_id = os.environ.get("IBM_WATSONX_PROJECT_ID", "").strip()
    url = os.environ.get(
        "IBM_WATSONX_URL", "https://us-south.ml.cloud.ibm.com"
    ).strip()

    if not api_key or not project_id:
        logger.info(
            "IBM_WATSONX_APIKEY or IBM_WATSONX_PROJECT_ID not set — "
            "EcoChat will use the Local Fallback."
        )
        _wx_ready = False
        return False

    try:
        from ibm_watsonx_ai import APIClient, Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

        credentials = Credentials(url=url, api_key=api_key)
        client = APIClient(credentials=credentials)

        _wx_client = ModelInference(
            model_id="ibm/granite-13b-chat-v2",
            api_client=client,
            project_id=project_id,
            params={
                GenParams.MAX_NEW_TOKENS: 512,
                GenParams.TEMPERATURE: 0.3,
                GenParams.REPETITION_PENALTY: 1.1,
                GenParams.STOP_SEQUENCES: ["\n\nHuman:", "\nHuman:"],
            },
        )
        # Lightweight probe — list models to confirm credentials work
        client.foundation_models.TextModels.show()
        _wx_ready = True
        logger.info("watsonx.ai client initialised successfully.")
        return True

    except Exception as exc:
        logger.warning(
            "watsonx.ai initialisation failed (%s) — using Local Fallback.", exc
        )
        _wx_ready = False
        return False


def _call_watsonx(user_message: str) -> str:
    """Send a message to Granite and return the reply text."""
    system_prompt = (
        "You are EcoChat, an expert AI assistant for the EcoSort AI waste management "
        "platform. You help users with waste segregation, recycling rules, composting, "
        "hazardous waste disposal, eco-points, and environmental best practices. "
        "Keep answers concise, friendly, and actionable. "
        "If asked something outside your domain, politely redirect to waste/eco topics."
    )
    prompt = (
        f"<|system|>\n{system_prompt}\n"
        f"<|user|>\n{user_message}\n"
        f"<|assistant|>\n"
    )
    result = _wx_client.generate_text(prompt=prompt)
    return result.strip()


# ---------------------------------------------------------------------------
# 3. Rule-based local fallback knowledge base
# ---------------------------------------------------------------------------
#
# Each entry is (list_of_keyword_patterns, answer_string).
# Patterns are matched case-insensitively against the user message.
# First match wins.
# ---------------------------------------------------------------------------

_KB: list[tuple[list[str], str]] = [
    # --- Plastic ---
    (
        [r"\bplastic\b", r"\bpet\b", r"\bhdpe\b", r"\bpolystyrene\b", r"\bplastics\b"],
        (
            "♻️ **Plastic** goes in the **Blue Recycling Bin**.\n\n"
            "✅ Accepted: PET bottles (♻1), HDPE containers (♻2), clean yogurt pots, "
            "plastic bags (at supermarket drop-off only).\n"
            "❌ Not accepted: polystyrene foam, crisp packets, cling film.\n\n"
            "💡 Tip: Rinse items clean and flatten bottles to save space."
        ),
    ),
    # --- Paper ---
    (
        [r"\bpaper\b", r"\bnewspaper\b", r"\bmagazine\b", r"\boffice paper\b", r"\bshredded\b"],
        (
            "♻️ **Paper** goes in the **Blue Recycling Bin**.\n\n"
            "✅ Accepted: newspapers, magazines, envelopes, office paper, shredded paper (in a bag).\n"
            "❌ Not accepted: greasy or wet paper, paper towels, tissues, waxed paper.\n\n"
            "💡 Tip: Keep paper dry — wet paper cannot be recycled."
        ),
    ),
    # --- Cardboard ---
    (
        [r"\bcardboard\b", r"\bbox\b", r"\bboxes\b", r"\bcorrugated\b"],
        (
            "♻️ **Cardboard** goes in the **Blue Recycling Bin**.\n\n"
            "✅ Accepted: cereal boxes, delivery boxes, toilet roll tubes.\n"
            "❌ Not accepted: waxed or laminated cardboard, pizza boxes with heavy grease.\n\n"
            "💡 Tip: Always flatten boxes before placing in the bin."
        ),
    ),
    # --- Glass ---
    (
        [r"\bglass\b", r"\bbottle\b", r"\bjar\b", r"\bglass bottle\b"],
        (
            "♻️ **Glass** goes in the **Green Glass Bin**.\n\n"
            "✅ Accepted: glass bottles, jars (rinsed).\n"
            "❌ Not accepted: broken glass (wrap in newspaper → Black General Waste Bin), "
            "Pyrex, mirrors, window glass.\n\n"
            "💡 Tip: Remove metal lids and recycle them separately in the Blue Bin."
        ),
    ),
    # --- Metal / Cans ---
    (
        [r"\bmetal\b", r"\bcan\b", r"\bcans\b", r"\baluminium\b", r"\bsteel\b",
         r"\btin\b", r"\baerosol\b", r"\bfoil\b"],
        (
            "♻️ **Metal** goes in the **Blue Recycling Bin**.\n\n"
            "✅ Accepted: food and drink cans, aluminium foil (scrunched to golf-ball size), "
            "empty aerosols, metal lids.\n"
            "❌ Not accepted: paint tins with dried paint, scrap metal (take to a recycling centre).\n\n"
            "💡 Tip: Rinse cans to prevent odours and contamination."
        ),
    ),
    # --- Organic / Compost ---
    (
        [r"\borganic\b", r"\bcompost\b", r"\bfood waste\b", r"\bfood scrap\b",
         r"\bpeel\b", r"\bvegetable\b", r"\bfruit\b", r"\bgarden waste\b",
         r"\bgrass\b", r"\bleaves\b"],
        (
            "🌱 **Organic waste** goes in the **Teal Food & Garden Waste Bin**.\n\n"
            "✅ Accepted: fruit and vegetable scraps, tea bags, coffee grounds, "
            "eggshells, garden clippings.\n"
            "❌ Not accepted: meat, fish, dairy, or oily food (in home compost).\n\n"
            "💡 Tip: A small kitchen caddy lined with a compostable bag makes collecting "
            "food waste much easier before emptying into the outdoor bin."
        ),
    ),
    # --- Textile ---
    (
        [r"\btextile\b", r"\bclothing\b", r"\bclothes\b", r"\bshoes\b",
         r"\bfabric\b", r"\bjeans\b", r"\bt-shirt\b", r"\bcurtain\b", r"\bbedding\b"],
        (
            "👕 **Textiles** go in the **Teal Textile Donation Bank**.\n\n"
            "✅ Accepted: clean and dry clothing, shoes (tied in pairs), curtains, bedding.\n"
            "❌ Not accepted: wet, mouldy, or heavily soiled items.\n\n"
            "💡 Tip: Many clothing retailers (H&M, Marks & Spencer, etc.) offer "
            "in-store take-back schemes — even for worn-out items."
        ),
    ),
    # --- E-waste ---
    (
        [r"\be-waste\b", r"\belectronic\b", r"\belectronics\b", r"\blaptop\b",
         r"\bphone\b", r"\bcomputer\b", r"\btablet\b", r"\bprinter\b",
         r"\bcharger\b", r"\bcable\b", r"\bweee\b"],
        (
            "⚠️ **E-Waste** must go to a **Yellow E-Waste Collection Point** — "
            "NOT in any regular bin.\n\n"
            "✅ Where to take it: certified e-waste recycling centres, "
            "retailer take-back programmes (most electronics stores accept old devices free), "
            "council recycling centres (HWRC).\n"
            "⚠️ Risk: e-waste contains lead, mercury, and cadmium — very harmful if landfilled.\n\n"
            "💡 Tip: Wipe your personal data before handing over any device."
        ),
    ),
    # --- Battery ---
    (
        [r"\bbattery\b", r"\bbatteries\b", r"\bcell\b", r"\baa battery\b",
         r"\brechargeable\b", r"\blithium\b", r"\bcar battery\b"],
        (
            "⚠️ **Batteries** must go to a **Yellow Battery Recycling Point** — "
            "NOT in any regular bin.\n\n"
            "✅ Where to take them: in-store drop-off boxes at supermarkets, "
            "DIY stores, and electronics retailers.\n"
            "⚠️ Car or industrial batteries: take to a garage or authorised recycler only.\n\n"
            "💡 Tip: Never put lithium batteries in general waste — they can cause fires "
            "in rubbish trucks."
        ),
    ),
    # --- Hazardous ---
    (
        [r"\bhazardous\b", r"\bpaint\b", r"\bsolvent\b", r"\bpesticide\b",
         r"\bchemical\b", r"\bcleaner\b", r"\bbleach\b", r"\bmotor oil\b",
         r"\bmedication\b", r"\bdrug\b", r"\bneedle\b", r"\bsyringe\b", r"\bsharps\b"],
        (
            "⚠️ **Hazardous waste** must go to a **Red Hazardous Waste Bin** "
            "or Household Hazardous Waste (HHW) facility — NEVER in regular bins.\n\n"
            "✅ Accepted at HHW: paints, solvents, pesticides, cleaning chemicals, motor oil.\n"
            "✅ Medications & sharps: return to a pharmacy — many operate free take-back schemes.\n\n"
            "💡 Tip: Keep items in their original containers with lids tightly closed "
            "during transport to the drop-off point."
        ),
    ),
    # --- Eco-points ---
    (
        [r"\beco.?point\b", r"\bpoints\b", r"\breward\b", r"\bscore\b", r"\brank\b"],
        (
            "🌟 **Eco-Points** are EcoSort AI's reward system!\n\n"
            "You earn points by:\n"
            "• Scanning and correctly classifying waste images 🔍\n"
            "• Completing pickup requests ✅\n"
            "• Reaching recycling milestones 🎯\n\n"
            "Points contribute to your rank on the community leaderboard. "
            "Keep recycling to climb the ranks and earn badges!"
        ),
    ),
    # --- Recycling general ---
    (
        [r"\brecycl\b", r"\brecycling\b", r"\bwhat can i recycle\b"],
        (
            "♻️ **General recycling guide:**\n\n"
            "| ✅ Recyclable | ❌ Not recyclable |\n"
            "|---|---|\n"
            "| Clean plastic bottles (♻1, ♻2) | Plastic bags / films |\n"
            "| Paper & cardboard (dry) | Greasy pizza boxes |\n"
            "| Glass bottles & jars | Broken glass |\n"
            "| Metal cans & foil | Paint tins (with paint) |\n\n"
            "💡 When in doubt, use the EcoSort AI image scanner — "
            "it will tell you exactly which bin to use!"
        ),
    ),
    # --- Composting tips ---
    (
        [r"\bcompost\b", r"\bcomposting\b", r"\bhow to compost\b", r"\bworm\b"],
        (
            "🌿 **Home composting tips:**\n\n"
            "1. **Balance greens & browns** — mix nitrogen-rich greens (food scraps, grass) "
            "with carbon-rich browns (cardboard, dried leaves) in roughly equal amounts.\n"
            "2. **Keep it moist** — the pile should feel like a wrung-out sponge.\n"
            "3. **Turn regularly** — aerate every 1–2 weeks to speed decomposition.\n"
            "4. **Avoid** meat, fish, dairy, oily food, and diseased plants.\n\n"
            "Ready compost is dark, crumbly, and earthy-smelling — usually in 3–6 months."
        ),
    ),
    # --- Bins / colours ---
    (
        [r"\bwhich bin\b", r"\bbin colou?r\b", r"\bwhat bin\b", r"\bwhat colou?r\b",
         r"\bbin guide\b", r"\bbin type\b"],
        (
            "🗑️ **EcoSort AI bin colour guide:**\n\n"
            "| Colour | What goes in |\n"
            "|---|---|\n"
            "| 🔵 Blue Recycling Bin | Plastic (♻1–2), paper, cardboard, metal cans |\n"
            "| 🟢 Green Glass Bin | Glass bottles & jars |\n"
            "| 🩵 Teal Compost Bin | Food scraps, garden waste, textiles |\n"
            "| 🟡 Yellow E-Waste / Battery Point | Electronics, batteries |\n"
            "| 🔴 Red Hazardous Bin | Chemicals, paint, sharps |\n"
            "| ⬛ Black General Waste | Everything else |\n\n"
            "Upload an image to the EcoSort scanner for an instant AI classification!"
        ),
    ),
    # --- Greeting / hello ---
    (
        [r"^hi\b", r"^hello\b", r"^hey\b", r"^good\s+(morning|afternoon|evening)\b",
         r"^what can you (do|help)\b", r"^how (do you work|does this work)\b"],
        (
            "👋 Hi! I'm **EcoChat**, your EcoSort AI waste management assistant.\n\n"
            "I can help you with:\n"
            "• 🗑️ Which bin to use for any type of waste\n"
            "• ♻️ Recycling rules and tips\n"
            "• 🌱 Composting guidance\n"
            "• ⚠️ Safe disposal of hazardous items\n"
            "• 🌟 How to earn Eco-Points\n\n"
            "Just ask me a question — or upload an image to the scanner for instant AI classification!"
        ),
    ),
    # --- Thank you ---
    (
        [r"\bthank\b", r"\bthanks\b", r"\bcheers\b"],
        (
            "You're welcome! 🌍 Every correct sort makes a difference. "
            "Keep up the great eco work — feel free to ask anything else!"
        ),
    ),
]


def _local_fallback(user_message: str) -> str:
    """
    Match the user's message against the knowledge base rules.
    Returns a matched answer or a polite default if nothing matches.
    """
    msg = user_message.strip().lower()
    for patterns, answer in _KB:
        for pattern in patterns:
            if re.search(pattern, msg, re.IGNORECASE):
                return answer

    # Default: friendly "I don't know" with suggestions
    return (
        "🤔 I'm not sure about that specific question, but here's how I can help:\n\n"
        "• Ask about a **specific material** (e.g. 'Where does glass go?')\n"
        "• Ask about **bin colours** (e.g. 'What goes in the blue bin?')\n"
        "• Ask about **composting**, **batteries**, **e-waste**, or **hazardous waste**\n"
        "• Or use the **image scanner** to classify any waste item instantly!\n\n"
        "Try rephrasing your question and I'll do my best to help. 🌱"
    )


# ---------------------------------------------------------------------------
# 4. Public API
# ---------------------------------------------------------------------------

def ask(user_message: str) -> ChatResponse:
    """
    Send a message to EcoChat and get a response.

    Tries watsonx.ai first; falls back to the local knowledge base if
    credentials are missing or the API call fails.
    """
    if _try_init_watsonx():
        try:
            answer = _call_watsonx(user_message)
            return ChatResponse(answer=answer, source="watsonx.ai")
        except Exception as exc:
            logger.warning(
                "watsonx.ai call failed (%s) — switching to Local Fallback.", exc
            )

    answer = _local_fallback(user_message)
    return ChatResponse(answer=answer, source="Local Fallback")
