import sys
import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Force absolute pathing for the backend modules
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_path = os.path.join(root, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import the router and database components
try:
    from routers import auth
    import models
    from database import engine
except Exception as e:
    # If imports fail, we create a dummy app to show the error
    error_app = FastAPI()
    @error_app.get("/{catchall:path}")
    async def err(catchall: str):
        return {"error": "Import Error", "detail": str(e), "trace": traceback.format_exc()}
    app = error_app

# The Main App Instance (Exposed at top level for Vercel)
app = FastAPI(title="Flux Share API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Server Error", "message": str(exc)}
    )

# Migration Endpoint
@app.get("/api/init-db")
@app.get("/init-db")
def init_db():
    models.Base.metadata.create_all(bind=engine)
    return {"message": "Database tables created successfully!"}

# Include Auth Router twice to handle prefix stripping vs no stripping 
# This is the ULTIMATE fix for 405 Method Not Allowed / 404
app.include_router(auth.router, prefix="/api")
app.include_router(auth.router)

# Fallback for frontend
@app.get("/{catchall:path}")
async def catchall(catchall: str):
    # This prevents the 405 error on POST requests 
    # because it will only respond to GET requests.
    return JSONResponse(
        status_code=404,
        content={"detail": "Path not found in API. Try /api/auth/google"}
    )
