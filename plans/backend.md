# Backend Plan - Family Tree Builder API

This document details the backend architectural design, REST endpoints, database schema models, and authentication flow using FastAPI and SQLModel.

## 1. Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI app initialization, middleware, routes mounting
│   ├── config.py          # Environment settings (DB URL, JWT secrets, CORS)
│   ├── db.py              # SQLModel engine creation, Session dependency
│   ├── models.py          # SQLModel database schemas (User, Tree, Person, Relationship)
│   ├── schemas/           # Pydantic models for request validation & responses
│   │   ├── auth.py
│   │   ├── tree.py
│   │   ├── person.py
│   │   └── relation.py
│   ├── routes/            # Route controllers
│   │   ├── auth.py
│   │   ├── trees.py
│   │   ├── people.py
│   │   └── relations.py
│   └── utils/
│       ├── auth_helpers.py # Google token validation, JWT encoding/decoding
│       └── cloudinary_store.py # Cloudinary image storage manager
├── tests/                 # Fast API endpoints tests (pytest)
├── requirements.txt
└── .env
```

---

## 2. Database Models (SQLModel)

### User Model
Authenticates solely via Google OAuth.
```python
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    email: str = Field(unique=True, index=True)
    google_id: str = Field(unique=True, index=True)
    name: str
    picture_url: Optional[str] = None
```

### Tree Model
Each family tree belongs to a User.
```python
class Tree(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tree_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    name: str
    description: Optional[str] = None
    owner_id: int = Field(foreign_key="user.id")
```

### Person Model
Represents a person in the family tree. Dynamic custom list are stored in a serialized JSON string.
```python
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
    custom_fields: str = Field(default="{}")
```

### Relationship Model
Links two people representing hierarchical or horizontal links.
```python
class RelationshipLink(SQLModel, table=True):
    __tablename__ = "relationshiplink"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    relationship_id: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    tree_id: int = Field(foreign_key="tree.id", index=True, ondelete="CASCADE")
    person_id: int = Field(foreign_key="person.id", ondelete="CASCADE", index=True)
    related_person_id: int = Field(foreign_key="person.id", ondelete="CASCADE")
    relation_type: str   # "spouse" | "parent"
    relation_subtype: Optional[str] = None  # parent: biological/adopted/step, spouse: married/partner/divorced
```

---

## 3. Endpoints Protocol

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| **POST** | `/api/v1/auth/google` | Validate Google ID token, upsert User, return JWT access token | No |
| **GET** | `/api/v1/auth/me` | Fetch active User profiles details | Yes |
| **GET** | `/api/v1/trees` | List all trees owned by active user | Yes |
| **POST** | `/api/v1/trees` | Create a new tree | Yes |
| **DELETE** | `/api/v1/trees/{tree_id}` | Delete a tree | Yes |
| **GET** | `/api/v1/trees/{tree_id}/data` | Fetch entire tree: nodes (`people`) and edges (`relationships`) | Yes |
| **POST** | `/api/v1/people` | Create a new Person node in tree | Yes |
| **PUT** | `/api/v1/people/{person_id}` | Update details/custom fields of target Person | Yes |
| **DELETE** | `/api/v1/people/{person_id}` | Delete a Person (implicitly cleans up relations) | Yes |
| **POST** | `/api/v1/media/upload` | Upload profile photo for a Person to Cloudinary | Yes |
| **POST** | `/api/v1/relationships` | Add a new relationship between two persons | Yes |
| **DELETE** | `/api/v1/relationships/{relationship_id}` | Delete a relationship link | Yes |

---

## 4. Google Authentication flow details

1. Frontend initiates Google login. Google returns a credential (ID Token).
2. Frontend sends ID Token to `/api/v1/auth/google`.
   * **Development Mock Bypass**: If `GOOGLE_CLIENT_ID` is empty (dev environment), the backend skips verify and immediately issues a test token acting as a mock user (`developer@clansandbranches.local`). This allows instant local testing without setting up Google developer credentials!
3. Backend verifies the token (when configured) using Google OAuth validator library.
4. Backend extracts `sub` (Google ID), `email`, `name`, and `picture`.
5. Backend searches for the user by `google_id`. If not found, a new User is entered.
6. Backend issues a signed HS256 JWT containing `{"sub": user_id}`.
7. Subsequent client headers use Bearer tokens: `Authorization: Bearer <JWT>`.

---

## 5. Media Storage (Cloudinary Integrated)

To handle scaling and persistent storage across both development and production (Render/Railway/Vercel):
* We implement `backend/app/utils/cloudinary_store.py` to manage image uploads.
* For all environments, the backend requires `CLOUDINARY_URL` in the `.env` configuration.
* When adding or updating a person, custom uploaded photos are sent directly to Cloudinary via the backend, and the returned Cloudinary CDN secure URL is stored in the database `Person.photo_url`.
* This setup keeps our backend completely stateless and ensures image assets remain persistent across server restarts and scaled instances.

