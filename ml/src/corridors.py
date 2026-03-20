from dataclasses import dataclass


@dataclass(frozen=True)
class Corridor:
    id: str
    name: str
    segment_ids: tuple[str, ...]


CORRIDORS: dict[str, Corridor] = {
    "us-101": Corridor(id="us-101", name="US-101", segment_ids=("TMC_PLACEHOLDER",)),
    "i-280": Corridor(id="i-280", name="I-280", segment_ids=("TMC_PLACEHOLDER",)),
    "bay-bridge": Corridor(
        id="bay-bridge", name="Bay Bridge Approach", segment_ids=("TMC_PLACEHOLDER",)
    ),
    "van-ness": Corridor(id="van-ness", name="Van Ness Ave", segment_ids=("TMC_PLACEHOLDER",)),
    "19th-ave": Corridor(id="19th-ave", name="19th Ave", segment_ids=("TMC_PLACEHOLDER",)),
    "market-st": Corridor(id="market-st", name="Market St", segment_ids=("TMC_PLACEHOLDER",)),
}


def get_corridor(corridor_id: str) -> Corridor:
    """Get a corridor by ID. Raises ValueError if not found."""
    if corridor_id not in CORRIDORS:
        raise ValueError(f"Unknown corridor: {corridor_id}. Valid: {list(CORRIDORS.keys())}")
    return CORRIDORS[corridor_id]
