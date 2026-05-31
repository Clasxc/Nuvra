import chromadb

# Create a ChromaDB client (in-memory for simplicity in this example)
# For a persistent database, you would specify a path: chromadb.PersistentClient(path="/path/to/your/db")
client = chromadb.Client()

# Create a collection (or get an existing one)
# You can specify an embedding function here if you don't want to use the default
collection = client.get_or_create_collection(name="my_course_materials")

# Add some sample documents to the collection
documents = [
    "Introduction to HTML: HTML is the standard markup language for documents designed to be displayed in a web browser.",
    "CSS Basics: CSS is a style sheet language used for describing the presentation of a document written in HTML or XML.",
    "JavaScript Fundamentals: JavaScript is a programming language that is one of the core technologies of the World Wide Web."
]

# Assign unique IDs to your documents
ids = [f"doc_{i}" for i in range(len(documents))]

# Add the documents to the collection
collection.add(
    documents=documents,
    ids=ids
)

print(f"Added {len(documents)} documents to the collection '{collection.name}'.")

# You can also perform a similarity search
query_text = "Tell me about styling web pages"
results = collection.query(
    query_texts=[query_text],
    n_results=1
)

print("\nSearch Results:")
print(results)
