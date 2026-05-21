docker rm -f cloud-engine-container
docker build -t cloud-engine-ai .
docker run -d -p 8000:8000 -e OLLAMA_HOST=http://host.docker.internal:4000 --add-host=host.docker.internal:host-gateway --name cloud-engine-container cloud-engine-ai