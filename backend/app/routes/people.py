from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import date
from sqlmodel import Session, select
from app.db import get_session
from app.models import Tree, Person, User
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api/v1/people", tags=["People (Members)"])

class PersonCreateRequest(BaseModel):
    tree_id: str
    name: str
    gender: str          # "male" | "female" | "other"
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    is_alive: bool = True
    native_place: Optional[str] = None
    current_place: Optional[str] = None
    occupation: Optional[str] = None
    photo_url: Optional[str] = None
    custom_fields: Optional[str] = "{}"

class PersonUpdateRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    is_alive: Optional[bool] = None
    native_place: Optional[str] = None
    current_place: Optional[str] = None
    occupation: Optional[str] = None
    photo_url: Optional[str] = None
    custom_fields: Optional[str] = None

@router.post("", response_model=Person, status_code=status.HTTP_201_CREATED)
def create_person(
    request: PersonCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Verify owner has permissions for the target family tree (using Tree UUID)
    tree = session.exec(select(Tree).where(Tree.tree_id == request.tree_id)).first()
    if not tree:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target family tree not found"
        )
        
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this tree"
        )
        
    person = Person(
        tree_id=tree.id, # Map to internal integer ID
        name=request.name,
        gender=request.gender,
        birth_date=request.birth_date,
        death_date=request.death_date,
        is_alive=request.is_alive,
        native_place=request.native_place,
        current_place=request.current_place,
        occupation=request.occupation,
        photo_url=request.photo_url,
        custom_fields=request.custom_fields
    )
    session.add(person)
    session.commit()
    session.refresh(person)
    return person

@router.put("/{person_id}", response_model=Person)
def update_person(
    person_id: str,
    request: PersonUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    person = session.exec(select(Person).where(Person.person_id == person_id)).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family member not found"
        )
        
    # Verify owner permissions by checking tree owner
    tree = session.get(Tree, person.tree_id)
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit members of this tree"
        )
        
    # Update properties dynamically
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(person, key, value)
        
    session.add(person)
    session.commit()
    session.refresh(person)
    return person

@router.delete("/{person_id}", status_code=status.HTTP_200_OK)
def delete_person(
    person_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    person = session.exec(select(Person).where(Person.person_id == person_id)).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family member not found"
        )
        
    # Verify owner permissions
    tree = session.get(Tree, person.tree_id)
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete members from this tree"
        )
        
    # SQLite Cascading deletes will automatically sweep away relationshiplinks connected to this person
    session.delete(person)
    session.commit()
    return {"message": "Family member and associated links deleted successfully", "deleted_person_id": person_id}
