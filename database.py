from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import chromadb
from chromadb.utils import embedding_functions

# Import config and models using relative imports for consistency
import config, models


# --- Database Configuration ---

# Construct the database URL from config variables
# This assumes a PostgreSQL database. Modify if you use a different one.
DATABASE_URL =  config.DATABASE_URL

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- ChromaDB Vector Store Configuration ---

# Define the path for persistent ChromaDB storage
CHROMA_DB_PATH = "chroma_db"

# Set up the default embedding function (using a sentence-transformers model)
# This model is downloaded on first use and cached.
default_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Create a persistent ChromaDB client
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)


# --- Dependency Functions for FastAPI ---

def get_db():
    """FastAPI dependency to provide a SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_chroma_client():
    """FastAPI dependency to provide a ChromaDB client instance."""
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    yield client


# --- Database Initialization ---

def create_db_tables():
    """Creates all tables defined in models.Base.metadata."""
    models.Base.metadata.create_all(bind=engine)
    print("Database tables created (or already exist).")