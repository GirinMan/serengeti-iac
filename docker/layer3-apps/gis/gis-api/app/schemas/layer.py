from pydantic import BaseModel


class LayerOut(BaseModel):
    id: int
    region_id: int | None
    code: str
    name: str
    category: str
    source_table: str | None
    tile_url: str | None
    min_zoom: int
    max_zoom: int
    visible: bool
    sort_order: int
    style: dict

    model_config = {"from_attributes": True}
