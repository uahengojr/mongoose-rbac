test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--require expect.js --reporter min

.PHONY: test