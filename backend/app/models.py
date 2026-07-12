from datetime import date
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import uuid

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    email: str = Field(unique=True, index=True)
    google_id: str = Field(unique=True, index=True)
    name: str
    picture_url: Optional[str] = None

    # Relationship back references
    trees: List["Tree"] = Relationship(back_populates="owner")

class Tree(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tree_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    name: str
    description: Optional[str] = None
    owner_id: int = Field(foreign_key="user.id")

    # Relationship back references
    owner: User = Relationship(back_populates="trees")
    people: List["Person"] = Relationship(back_populates="tree")
    relationships: List["RelationshipLink"] = Relationship(back_populates="tree")

class Person(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    person_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    tree_id: int = Field(foreign_key="tree.id", ondelete="CASCADE", index=True)
    name: str
    gender: str          # "male" | "female" | "other"
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    is_alive: bool = True
    native_place: Optional[str] = None
    current_place: Optional[str] = None
    occupation: Optional[str] = None
    photo_url: Optional[str] = None
    
    # Store dynamic key-values as a serialized JSON string (e.g. '{"Favorite food": "Pizza"}')
    custom_fields: str = Field(default="{}")

    # Relationship back references
    tree: Tree = Relationship(back_populates="people")

class RelationshipLink(SQLModel, table=True):
    # Named "RelationshipLink" to avoid name collisions with SQLModel's "Relationship"
    __tablename__ = "relationshiplink"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    relationship_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    tree_id: int = Field(foreign_key="tree.id", ondelete="CASCADE", index=True)
    person_id: int = Field(foreign_key="person.id", ondelete="CASCADE", index=True)          # Source (Parent or Spouse A)
    related_person_id: int = Field(foreign_key="person.id", ondelete="CASCADE", index=True)  # Target (Child or Spouse B)
    relation_type: str   # "spouse" | "parent"
    relation_subtype: Optional[str] = None  # parent: biological/adopted/step, spouse: married/partner/divorced

    # Relationship back references
    tree: Tree = Relationship(back_populates="relationships")
