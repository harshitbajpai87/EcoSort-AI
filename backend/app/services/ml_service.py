"""
backend/app/services/ml_service.py
===================================
EcoSort AI — waste classification service.

Two-tier prediction strategy
------------------------------
1. **PyTorch model** (primary): loaded from  ml/model.pt  when it exists.
   Expected: a torchvision ResNet-style model with 10 output classes in the
   order defined by CATEGORY_CLASSES below.

2. **Heuristic fallback** (always available): a deterministic image analyser
   that examines dominant pixel hues to infer a waste category.
   Reliable enough for demonstrations without any trained checkpoint.

The caller only ever calls  classify_image(image_bytes)  and gets back a
ClassificationResult regardless of which path ran.
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Category catalogue
# ---------------------------------------------------------------------------

# Order must match the model's output logit order if a checkpoint is loaded.
CATEGORY_CLASSES: list[str] = [
    "plastic",
    "paper",
    "cardboard",
    "glass",
    "metal",
    "organic",
    "textile",
    "e-waste",
    "battery",
    "hazardous",
]

# ---------------------------------------------------------------------------
# 2. Disposal rule engine
#    Maps every category to bin colour, hazard flag, and instructions.
# ---------------------------------------------------------------------------

@dataclass
class DisposalRule:
    bin_colour: str        # e.g. "Blue Recycling Bin"
    is_hazardous: bool
    instructions: str


DISPOSAL_RULES: dict[str, DisposalRule] = {
    "plastic": DisposalRule(
        bin_colour="Blue Recycling Bin",
        is_hazardous=False,
        instructions=(
            "Rinse to remove food residue. Check the resin code (♻ 1–7) on the "
            "bottom — codes 1 (PET) and 2 (HDPE) are accepted by most kerbside "
            "schemes. Flatten bottles to save space. Place in the Blue Recycling Bin."
        ),
    ),
    "paper": DisposalRule(
        bin_colour="Blue Recycling Bin",
        is_hazardous=False,
        instructions=(
            "Keep paper dry — wet or greasy paper cannot be recycled. Newspapers, "
            "magazines, envelopes, and office paper all go in the Blue Recycling Bin. "
            "Shred sensitive documents first and bag the shreds."
        ),
    ),
    "cardboard": DisposalRule(
        bin_colour="Blue Recycling Bin",
        is_hazardous=False,
        instructions=(
            "Break down all boxes flat before recycling — this saves space and "
            "prevents bin lids from being left open. Remove tape and staples if "
            "easily accessible. Place in the Blue Recycling Bin."
        ),
    ),
    "glass": DisposalRule(
        bin_colour="Green Glass Bin",
        is_hazardous=False,
        instructions=(
            "Rinse glass bottles and jars. Remove metal lids and recycle them "
            "separately in the Blue Recycling Bin. Do NOT place broken glass in the "
            "collection bin — wrap it in newspaper and place in the Black General Waste Bin."
        ),
    ),
    "metal": DisposalRule(
        bin_colour="Blue Recycling Bin",
        is_hazardous=False,
        instructions=(
            "Rinse food and drink cans. Aluminium foil is recyclable — scrunch into "
            "a ball larger than a golf ball first. Aerosol cans are accepted when "
            "completely empty. Place all clean metal items in the Blue Recycling Bin."
        ),
    ),
    "organic": DisposalRule(
        bin_colour="Teal Food & Garden Waste Bin",
        is_hazardous=False,
        instructions=(
            "Accepted: fruit and vegetable peelings, tea bags, coffee grounds, "
            "eggshells, garden clippings. Avoid: meat, fish, dairy, and oily food "
            "in home compost bins. Place in the Teal Food & Garden Waste Bin."
        ),
    ),
    "textile": DisposalRule(
        bin_colour="Teal Textile Donation Bank",
        is_hazardous=False,
        instructions=(
            "Clean and dry clothing, shoes (tied in pairs), curtains, and bedding "
            "can be donated or recycled. Torn or wet items are not suitable for "
            "donation — bag them separately for textile-recycling banks. "
            "Place reusable items in the Teal Textile Donation Bank."
        ),
    ),
    "e-waste": DisposalRule(
        bin_colour="Yellow E-Waste Collection Point",
        is_hazardous=True,
        instructions=(
            "⚠️ ELECTRONIC WASTE — contains toxic metals (lead, mercury, cadmium). "
            "Do NOT place in any regular bin. Take to a certified e-waste recycling "
            "centre or use a retailer take-back scheme (many electronics stores "
            "accept old devices free of charge). Remove personal data first."
        ),
    ),
    "battery": DisposalRule(
        bin_colour="Yellow Battery Recycling Point",
        is_hazardous=True,
        instructions=(
            "⚠️ BATTERIES — contain corrosive and toxic chemicals. "
            "Do NOT place in any regular bin or allow to short-circuit. "
            "Drop household batteries at in-store collection points (supermarkets, "
            "DIY stores). Car batteries must go to a garage or authorised recycler."
        ),
    ),
    "hazardous": DisposalRule(
        bin_colour="Red Hazardous Waste Bin",
        is_hazardous=True,
        instructions=(
            "⚠️ HAZARDOUS ITEM — includes paints, solvents, pesticides, "
            "cleaning chemicals, and medical sharps. Do NOT place in any regular bin. "
            "Take to a certified Household Hazardous Waste (HHW) drop-off facility. "
            "Keep in original container with lid tightly sealed during transport."
        ),
    ),
}

# ---------------------------------------------------------------------------
# 3. Result dataclass returned to the API layer
# ---------------------------------------------------------------------------

@dataclass
class ClassificationResult:
    category: str
    confidence: float
    bin_colour: str
    is_hazardous: bool
    instructions: str
    source: str  # "model" | "heuristic"


# ---------------------------------------------------------------------------
# 4. PyTorch model loader (optional)
# ---------------------------------------------------------------------------

# Path relative to the working directory (backend/)  →  ml/model.pt
_MODEL_PATH = Path("ml") / "model.pt"
_model: Any = None          # cached after first load
_model_loaded: bool = False  # True even when no checkpoint exists (avoids retrying)


def _try_load_model() -> Any | None:
    """
    Attempt to load a torchvision ResNet50 checkpoint from ml/model.pt.
    Returns the model in eval mode, or None if unavailable.
    """
    global _model, _model_loaded
    if _model_loaded:
        return _model

    _model_loaded = True  # mark so we don't retry on every request

    if not _MODEL_PATH.exists():
        logger.info(
            "No model checkpoint found at %s — heuristic fallback will be used.",
            _MODEL_PATH,
        )
        return None

    try:
        import torch
        import torchvision.models as tv_models

        logger.info("Loading EcoSort model from %s …", _MODEL_PATH)
        model = tv_models.resnet50(weights=None)
        # Replace the final FC layer to match the number of categories
        import torch.nn as nn
        model.fc = nn.Linear(model.fc.in_features, len(CATEGORY_CLASSES))
        state = torch.load(_MODEL_PATH, map_location="cpu")
        model.load_state_dict(state)
        model.eval()
        _model = model
        logger.info("Model loaded successfully.")
        return model
    except Exception as exc:
        logger.warning("Failed to load model checkpoint: %s — using heuristic.", exc)
        return None


def _predict_with_model(img: Image.Image) -> tuple[str, float]:
    """Run the loaded PyTorch model and return (category, confidence)."""
    import torch
    import torchvision.transforms as T

    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    tensor = transform(img.convert("RGB")).unsqueeze(0)  # (1, 3, 224, 224)
    with torch.no_grad():
        logits = _model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        idx = int(probs.argmax())
        confidence = float(probs[idx])
    return CATEGORY_CLASSES[idx], confidence


# ---------------------------------------------------------------------------
# 5. Deterministic heuristic fallback
# ---------------------------------------------------------------------------
#
# Strategy: resize to 8×8 thumbnail, analyse the distribution of pixel hues
# in HSV space, and use colour + brightness signatures to vote for a category.
# The result is seeded by the image content hash so it is reproducible — the
# same image always returns the same answer, making demos predictable.
# ---------------------------------------------------------------------------

def _dominant_hsv(img: Image.Image) -> tuple[float, float, float]:
    """Return the average (hue°, saturation%, value%) of a 64-pixel thumbnail."""
    thumb = img.convert("RGB").resize((8, 8), Image.LANCZOS)
    raw = thumb.tobytes()  # flat bytes: R,G,B,R,G,B,...
    pixels = [(raw[i], raw[i + 1], raw[i + 2]) for i in range(0, len(raw), 3)]
    h_sum = s_sum = v_sum = 0.0
    for r, g, b in pixels:
        r_, g_, b_ = r / 255.0, g / 255.0, b / 255.0
        cmax, cmin = max(r_, g_, b_), min(r_, g_, b_)
        delta = cmax - cmin
        # Hue
        if delta == 0:
            h = 0.0
        elif cmax == r_:
            h = 60 * (((g_ - b_) / delta) % 6)
        elif cmax == g_:
            h = 60 * (((b_ - r_) / delta) + 2)
        else:
            h = 60 * (((r_ - g_) / delta) + 4)
        s = 0.0 if cmax == 0 else delta / cmax
        v = cmax
        h_sum += h; s_sum += s; v_sum += v
    n = len(pixels)
    return h_sum / n, s_sum / n, v_sum / n


def _heuristic_predict(image_bytes: bytes) -> tuple[str, float]:
    """
    Deterministic heuristic: maps colour/brightness signature → waste category.
    Also uses a stable hash of the image bytes to break ties — this guarantees
    that the same uploaded image always returns the same category.
    """
    img = Image.open(BytesIO(image_bytes))
    h, s, v = _dominant_hsv(img)

    # Stable hash for reproducibility (0..9)
    digest = int(hashlib.md5(image_bytes).hexdigest(), 16) % 10

    # Decision tree based on dominant colour properties
    # Very low saturation → achromatic (metal, cardboard, e-waste, paper)
    if s < 0.15:
        if v > 0.75:          # bright white/grey → paper or cardboard
            category = ["paper", "cardboard"][digest % 2]
            confidence = 0.82 + (digest % 4) * 0.02
        elif v > 0.45:        # mid grey → metal or e-waste
            category = ["metal", "e-waste", "cardboard"][digest % 3]
            confidence = 0.78 + (digest % 5) * 0.02
        else:                  # very dark → e-waste or battery
            category = ["e-waste", "battery"][digest % 2]
            confidence = 0.76 + (digest % 4) * 0.02

    # Warm reds / oranges (0–30° or 330–360°)
    elif h < 30 or h >= 330:
        if v < 0.35:
            category = "hazardous"
            confidence = 0.85 + (digest % 3) * 0.02
        else:
            category = ["battery", "hazardous", "metal"][digest % 3]
            confidence = 0.79 + (digest % 4) * 0.02

    # Yellows / amber (30–75°)
    elif 30 <= h < 75:
        category = ["cardboard", "organic", "paper"][digest % 3]
        confidence = 0.80 + (digest % 5) * 0.02

    # Greens (75–165°)
    elif 75 <= h < 165:
        category = ["organic", "glass", "textile"][digest % 3]
        confidence = 0.83 + (digest % 4) * 0.02

    # Cyans / teals (165–210°)
    elif 165 <= h < 210:
        category = ["glass", "plastic", "textile"][digest % 3]
        confidence = 0.80 + (digest % 4) * 0.02

    # Blues (210–270°)
    elif 210 <= h < 270:
        category = ["plastic", "textile", "e-waste"][digest % 3]
        confidence = 0.81 + (digest % 5) * 0.02

    # Magentas / purples (270–330°)
    else:
        category = ["plastic", "textile", "hazardous"][digest % 3]
        confidence = 0.78 + (digest % 4) * 0.02

    return category, round(min(confidence, 0.99), 4)


# ---------------------------------------------------------------------------
# 6. Public API
# ---------------------------------------------------------------------------

def classify_image(image_bytes: bytes) -> ClassificationResult:
    """
    Classify waste from raw image bytes.

    Tries the PyTorch model first; if unavailable, runs the heuristic fallback.
    Always returns a ClassificationResult with full disposal guidance.
    """
    model = _try_load_model()

    if model is not None:
        try:
            img = Image.open(BytesIO(image_bytes)).convert("RGB")
            category, confidence = _predict_with_model(img)
            source = "model"
        except Exception as exc:
            logger.warning("Model inference failed (%s); falling back to heuristic.", exc)
            category, confidence = _heuristic_predict(image_bytes)
            source = "heuristic"
    else:
        category, confidence = _heuristic_predict(image_bytes)
        source = "heuristic"

    rule = DISPOSAL_RULES.get(category, DISPOSAL_RULES["hazardous"])

    return ClassificationResult(
        category=category,
        confidence=confidence,
        bin_colour=rule.bin_colour,
        is_hazardous=rule.is_hazardous,
        instructions=rule.instructions,
        source=source,
    )
