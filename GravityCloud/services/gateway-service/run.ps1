$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

docker rm -f cloud-engine-container
docker build -t cloud-engine-ai .
docker run -d -p 8000:8000 -e OLLAMA_HOST=http://host.docker.internal:11434 --add-host=host.docker.internal:host-gateway --name cloud-engine-container cloud-engine-ai