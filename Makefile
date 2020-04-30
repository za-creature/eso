include .env
bin/ffmpeg:
	docker build -t ffmpeg ffmpeg
	docker run -v $(shell pwd)/bin:/var/task/out -it ffmpeg


debug:
	docker run -v $(shell pwd)/bin:/var/task/out -it ffmpeg bash --rcfile /dev/null


deploy: bin/ffmpeg
	gcloud functions deploy eso \
		--region=$(REGION) \
		--runtime=nodejs10 \
		--memory=2048MB \
		--timeout=540s \
		--trigger-resource $(INPUT_BUCKET) \
		--trigger-event google.storage.object.finalize \
