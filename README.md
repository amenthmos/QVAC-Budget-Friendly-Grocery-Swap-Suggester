# QVAC Budget-Friendly Grocery Swap Suggester

Enter an expensive grocery item and an on-device AI suggests 2-3 cheaper alternatives with a brief note on the tradeoff. No specific prices or dollar amounts — the model can't know real current prices, so it sticks to general swap advice. No cloud call, no API key.

## Run

```bash
npm install
npm start
```

Then open http://localhost:32011

## QVAC SDK version

`@qvac/sdk` ^0.19.0 (see `package.json`).

## How it works

Built on [Tether's QVAC SDK](https://www.npmjs.com/package/@qvac/sdk) — all inference runs on-device, no cloud call, no API key. The app loads `LLAMA_3_2_1B_INST_Q4_0` locally with `loadModel()`, generates with `completion()` (streamed via `tokenStream`), and releases the model with `unloadModel()` on shutdown.

Any price or dollar-amount mentions the model might hallucinate are stripped deterministically in code, since a small on-device model has no way to know real current prices.

## Example

Input: `{"item":"salmon fillets"}`

Output (from a real run):
```json
{"item":"salmon fillets","swaps":[
  {"name":"Pork or chicken breast","note":"leaner, milder, and often cheaper, but lower in nutrients and less rich in omega-3s."},
  {"name":"Turkey or duck breast","note":"slightly leaner than pork or chicken, but still less expensive, with a slightly gamier flavor."},
  {"name":"Organ meats like liver or tripe","note":"rich in nutrients but often more expensive, with a stronger flavor and firmer texture."}
]}
```

## License

MIT
