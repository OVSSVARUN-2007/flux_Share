from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from database import engine
import models
from routers import auth

# Initialize the database (do NOT run on global scope in Serverless to prevent Vercel boot timeouts)
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Flux Share API")

@app.get("/api/init-db")
def init_db():
    models.Base.metadata.create_all(bind=engine)
    return {"message": "Database tables created successfully!"}

# Setup CORS to allow React frontend to call the API perfectly in Production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

# In production (when dist exists), mount the static files
if os.path.exists(frontend_dist):
    # Vite outputs static files to /assets
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Specifically handle Vite's public assets if any (vite.svg, etc)
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Prevent path traversal
        if ".." in catchall:
            return {"error": "Invalid path"}
            
        file_path = os.path.join(frontend_dist, catchall)
        
        # If the requested file exists (like favicon, robots.txt), serve it
        if catchall and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Otherwise serve the SPA index.html
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        return {"error": "Index file not found in frontend build."}
else:
    @app.get("/{catchall:path}")
    def missing_frontend(catchall: str):
        return {"error": "Frontend build not found. Please run 'npm run build' in the frontend/ folder."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
