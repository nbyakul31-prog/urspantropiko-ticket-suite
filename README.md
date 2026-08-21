# ASEAN Youth Summit 2026 — Event Registration System

## Architecture Overview

```
 [Online Core]                          [Offline Isolated Core]
 -------------                          -----------------------
 | Public App|  ---> [ Redis Queue ] ---> | Worker Daemon       |
 | (FastAPI) |                            | (Python)            |
 -------------                            -----------------------
                                                    |
                                                    v
                                          [ PostgreSQL DB ]
                                                    |
                                                    v
                                          [ Admin Dashboard ]
                                          | (FastAPI)       |
                                          -------------------
```

## Prerequisites
- Docker
- Docker Compose

## Quick Start

1. **Clone/copy project**
   Ensure all files are in your directory.

2. **Generate Fernet key**
   Run the following command in your terminal:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and fill in the `FERNET_KEY` with the output from the previous step.

4. **Start Online Stack**
   ```bash
   docker-compose -f docker-compose.online.yml up -d --build
   ```

5. **Start Offline Stack**
   ```bash
   docker-compose -f docker-compose.offline.yml up -d --build
   ```

6. **Access Public Form**
   http://localhost:8000

7. **Access Admin Dashboard**
   http://localhost:8001

## Testing

Test the registration API with `curl`:
```bash
curl -X POST http://localhost:8000/api/register \
     -H "Content-Type: application/json" \
     -d '{
       "full_name": "Test User",
       "email": "test@example.com",
       "phone": "+6281234567890",
       "country": "Indonesia",
       "organization": "ASEAN Tech",
       "role_title": "Developer",
       "dietary_preference": "Halal"
     }'
```

## Troubleshooting
- **Database Connection Errors:** Ensure the offline stack is running and the database has initialized properly.
- **Decryption Errors:** Make sure the `FERNET_KEY` is consistent across both `.env` and the docker-compose environment variables. 

## Security Notes
The system uses field-level Fernet symmetric encryption. Ensure your `FERNET_KEY` is kept secure and do not commit the `.env` file to source control.
