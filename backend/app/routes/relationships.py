from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select, and_, or_
from app.db import get_session
from app.models import Tree, Person, RelationshipLink, User
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api/v1/relationships", tags=["Relationships"])

class RelationshipCreateRequest(BaseModel):
    tree_id: str            # Tree UUID
    person_id: str          # Source Person UUID
    related_person_id: str  # Target Person UUID
    relation_type: str      # "spouse" | "parent"
    relation_subtype: Optional[str] = None  # parent: biological/adopted/step, spouse: married/partner/divorced

@router.post("", response_model=RelationshipLink, status_code=status.HTTP_201_CREATED)
def create_relationship(
    request: RelationshipCreateRequest,
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
        
    # Verify both people exist in the database and belong to the correct tree (using Person UUIDs)
    person = session.exec(select(Person).where(Person.person_id == request.person_id)).first()
    related_person = session.exec(select(Person).where(Person.person_id == request.related_person_id)).first()
    
    if not person or not related_person:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or both individuals in this relationship do not exist"
        )
        
    if person.tree_id != tree.id or related_person.tree_id != tree.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both individuals must belong to the target family tree"
        )
        
    # Prevent linking a person to themselves
    if request.person_id == request.related_person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot establish a relationship from a person to themselves"
        )

    # Check to see if this relationship already exists to prevent duplicate entries
    existing_rel = session.exec(
        select(RelationshipLink).where(
            and_(
                RelationshipLink.tree_id == tree.id,
                RelationshipLink.person_id == person.id,
                RelationshipLink.related_person_id == related_person.id,
                RelationshipLink.relation_type == request.relation_type
            )
        )
    ).first()
    
    if existing_rel:
        return existing_rel

    # For spouse connections, check the inverse (B -> A) to prevent duplicates as well
    if request.relation_type == "spouse":
        inverse_rel = session.exec(
            select(RelationshipLink).where(
                and_(
                    RelationshipLink.tree_id == tree.id,
                    RelationshipLink.person_id == related_person.id,
                    RelationshipLink.related_person_id == person.id,
                    RelationshipLink.relation_type == "spouse"
                )
            )
        ).first()
        if inverse_rel:
            return inverse_rel

    new_rel = RelationshipLink(
        tree_id=tree.id,
        person_id=person.id,
        related_person_id=related_person.id,
        relation_type=request.relation_type,
        relation_subtype=request.relation_subtype
    )
    session.add(new_rel)
    session.commit()
    session.refresh(new_rel)
    return new_rel

@router.delete("/{relationship_id}", status_code=status.HTTP_200_OK)
def delete_relationship(
    relationship_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    rel = session.exec(select(RelationshipLink).where(RelationshipLink.relationship_id == relationship_id)).first()
    if not rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship link not found"
        )
        
    # Verify owner has permissions for the target family tree
    tree = session.get(Tree, rel.tree_id)
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete relationships from this tree"
        )
        
    session.delete(rel)
    session.commit()
    return {"message": "Relationship link deleted successfully"}
