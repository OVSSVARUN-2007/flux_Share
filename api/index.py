import sys
import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Establish paths
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_path = os.path.join(root, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

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
        content={"detail": "Runtime Error", "message": str(exc), "trace": traceback.format_exc()}
    )

try:
    from routers import auth
    import models
    from database import engine

    # Migration Endpoint
    @app.get("/api/init-db")
    @app.get("/init-db")
    def init_db():
        models.Base.metadata.create_all(bind=engine)
        return {"message": "Database tables created successfully!"}

    # Include Auth Router
    app.include_router(auth.router, prefix="/api")
    app.include_router(auth.router)

except Exception as e:
    # If the setup fails, we add a single route to help debug
    @app.get("/{catchall:path}")
    async def debug_error(catchall: str):
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Setup Error during import/initialization",
                "message": str(e),
                "trace": traceback.format_exc(),
                "sys_path": sys.path
            }
        )
