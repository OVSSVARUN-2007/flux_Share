import sys
import os

# Instruct Vercel's backend network to properly point into your backend directory
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

# Expose the FastAPI app securely to Vercel Serverless automatically
from main import app
