test:
	@NODE_ENV=test ./node_modules/.bin/mocha --require chai --reporter min

.PHONY: test
