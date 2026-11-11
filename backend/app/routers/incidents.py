"""Endpoints for single incidents."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import IncidentDetailOut
from app.services.views import get_incident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/{incident_id}", response_model=IncidentDetailOut)
def get_incident_detail(incident_id: int, db: Session = Depends(get_db)):
    """One incident with its analysis, service timeline, similar incidents, and log lines."""
    incident = get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")
    return incident
