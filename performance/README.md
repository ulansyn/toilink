# ToiLink JMeter smoke performance test

This is a small learning-oriented JMeter plan, not a stress test.

## Scenario

The plan runs:

1. `GET /landing.html`
2. `GET /api/public/landing`
3. `POST /api/auth/login`
4. `GET /api/auth/me`
5. `GET /api/organizer/events`
6. `GET /api/organizer/events/summary`

Default load:

- 5 virtual users
- 10 second ramp-up
- 3 loops per user
- 300 ms think time between requests

## How to run in JMeter UI

1. Start the ToiLink app locally on `http://localhost:8888`.
2. Open JMeter.
3. `File -> Open` and select `performance/toilink-basic.jmx`.
4. Open `Test Plan -> User Defined Variables`.
5. Check these values:
   - `host`: `localhost`
   - `port`: `8888`
   - `phone`: a test phone, for example `+996700000000`
   - `password`: a test password, for example `pass1234`
6. Click the green Run button.
7. Check `Summary Report`.

## What to look at first

- `Error %` should be `0.00%`.
- `Average` shows average response time in ms.
- `Min` / `Max` show best and worst response time.
- `Throughput` shows requests per second.

For a first educational run, do not increase users yet. First make sure all requests are green.

## After the first green run

Try only one change at a time:

- Increase threads from `5` to `10`.
- Then increase loops from `3` to `10`.
- Then test `20` threads.

Keep `View Results Tree` only for debugging. It uses memory and should be disabled for bigger tests.

## Quick stress test

Open `performance/toilink-quick-stress.jmx` when the basic plan is green.

It runs two steps one after another:

1. 10 users
2. 500 users

Each step does 5 loops with a short 150 ms pause. It should finish quickly.

Use it to answer a rough question: "Does the app stay stable after a jump from small load to heavy concurrency?"

Simple interpretation:

- `10 users` green: the scenario itself is probably valid.
- `500 users` green: the app survived this quick local spike.
- Errors appear: the app, DB, or local machine is already struggling.
- Average or Max jumps hard between steps: you found the area where capacity starts to bend.

For a real capacity number, run from another machine and use production-like data. Running JMeter and the app on the same laptop measures both the app and your laptop.

## Live graph

`toilink-quick-stress.jmx` includes `Response Time Graph - live`.

Click it while the test is running to watch response times. You can also add more built-in listeners manually:

- `Add -> Listener -> Response Time Graph`
- `Add -> Listener -> Graph Results`

For bigger tests, prefer `Summary Report` and one graph only. Too many listeners slow down JMeter.
