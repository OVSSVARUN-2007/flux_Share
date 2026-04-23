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

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="Flux Share API")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}"}
    )

@app.get("/api/init-db")
def init_db():
    models.Base.metadata.create_all(bind=engine)
    return {"message": "Database tables created successfully!"}

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PATH NORMALIZATION MIDDLEWARE
# This ensures that /api/auth/google and /auth/google both work correctly
@app.middleware("http")
async def normalize_path_middleware(request: Request, call_next):
    path = request.scope['path']
    if path.startswith("/api/api/"):
        request.scope['path'] = path.replace("/api/api/", "/api/", 1)
    elif path.startswith("/api/") and not any(route.path.startswith("/api/") for route in app.routes if hasattr(route, 'path')):
        # If the app routes don't have /api/ but the request does, we strip it
        pass
    
    # Force the router to handle both /api/auth and /auth styles
    return await call_next(request)

# Universal router inclusion (handles both /api/auth and /auth)
app.include_router(auth.router, prefix="/api")
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
