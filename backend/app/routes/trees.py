from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlmodel import Session, select
from app.db import get_session
from app.models import Tree, Person, RelationshipLink, User
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api/v1/trees", tags=["Trees"])

class TreeCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None

class TreeResponse(BaseModel):
    id: int
    tree_id: str
    name: str
    description: Optional[str]
    owner_id: int

class RelationshipResponse(BaseModel):
    id: int
    relationship_id: str
    tree_id: str
    person_id: str
    related_person_id: str
    relation_type: str
    relation_subtype: Optional[str] = None

class TreeDataResponse(BaseModel):
    tree: TreeResponse
    people: List[Person]
    relationships: List[RelationshipResponse]

@router.post("", response_model=TreeResponse, status_code=status.HTTP_201_CREATED)
def create_tree(
    request: TreeCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tree = Tree(
        name=request.name,
        description=request.description,
        owner_id=current_user.id
    )
    session.add(tree)
    session.commit()
    session.refresh(tree)
    return tree

@router.get("", response_model=List[TreeResponse])
def get_user_trees(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    trees = session.exec(select(Tree).where(Tree.owner_id == current_user.id)).all()
    return trees

@router.get("/{tree_id}/data", response_model=TreeDataResponse)
def get_tree_canvas_data(
    tree_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tree = session.exec(select(Tree).where(Tree.tree_id == tree_id)).first()
    if not tree:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family tree not found"
        )
        
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this family tree"
        )
        
    # Fetch flat list of all family member nodes inside this tree
    people = session.exec(select(Person).where(Person.tree_id == tree.id)).all()
    
    # Fetch flat list of all relationship edges inside this tree
    relationships = session.exec(select(RelationshipLink).where(RelationshipLink.tree_id == tree.id)).all()
    
    # Map internal DB integer IDs of people to their public UUID strings for relationships
    person_uuid_map = {p.id: p.person_id for p in people}
    
    mapped_relationships = []
    for rel in relationships:
        mapped_relationships.append({
            "id": rel.id,
            "relationship_id": rel.relationship_id,
            "tree_id": tree.tree_id,
            "person_id": person_uuid_map.get(rel.person_id, ""),
            "related_person_id": person_uuid_map.get(rel.related_person_id, ""),
            "relation_type": rel.relation_type,
            "relation_subtype": rel.relation_subtype
        })
    
    return {
        "tree": {
            "id": tree.id,
            "tree_id": tree.tree_id,
            "name": tree.name,
            "description": tree.description,
            "owner_id": tree.owner_id
        },
        "people": people,
        "relationships": mapped_relationships
    }

@router.delete("/{tree_id}", status_code=status.HTTP_200_OK)
def delete_tree(
    tree_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tree = session.exec(select(Tree).where(Tree.tree_id == tree_id)).first()
    if not tree:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family tree not found"
        )
        
    if tree.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this family tree"
        )
        
    # 1. Clean up all relationship links belonging to this tree first
    relationships = session.exec(select(RelationshipLink).where(RelationshipLink.tree_id == tree.id)).all()
    for rel in relationships:
        session.delete(rel)
        
    # 2. Clean up all people belonging to this tree
    people = session.exec(select(Person).where(Person.tree_id == tree.id)).all()
    for person in people:
        session.delete(person)
        
    # 3. Clean up the tree itself
    session.delete(tree)
    session.commit()
    return {"message": "Family tree and all connected members deleted successfully"}
