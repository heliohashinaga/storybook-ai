import { describe, expect, it } from "vitest";
import {
  TtsProviderError,
  type TtsProvider,
  type TtsProviderErrorKind,
  type SynthesizedAudio,
  type TtsSynthesisOptions,
} from "../../src/features/story-read-aloud/server/tts-provider";
import type { NarrateRequest, NarrateResponse } from "./tts.contract";

/**
 * Contract test for the TTS provider seam (spec 004, T006).
 *
 * Pins the provider interface and its typed error kinds to the wire contract
 * (`NarrateRequest`/`NarrateResponse`/`NarrateError` in `tts.contract.ts`).
 * If the provider types drift from the contract, this test fails at the type
 * level — that is the point of a contract test.
 */

// --- Compile-time contract checks -------------------------------------------
// `NarrateRequest` drives the provider seam: `synthesize(text, { locale })`.
// The options locale must be exactly the contract's locale set.
type ContractLocale = NarrateRequest["locale"];
const _localeCheck: ContractLocale = "pt-BR";
const _localeCheck2: ContractLocale = "en";
// A provider-synthesized audio result satisfies the wire NarrateResponse shape.
const _responseCheck: NarrateResponse = {
  format: "audio/mpeg",
  audio: new Uint8Array([1]),
};
void _localeCheck;
void _localeCheck2;
void _responseCheck;

// Provider kinds must be expressible in terms of the contract error codes
// (each narration error code has a matching provider failure kind).
const kindToContractCode: Record<TtsProviderErrorKind, string> = {
  unavailable: "narration_unavailable",
  timeout: "narration_timeout",
  invalid: "invalid_input",
  over_limit: "rate_limited",
};

describe("TTS provider contract (T006)", () => {
  it("synthesize accepts a NarrateRequest-shaped input (text + locale)", async () => {
    // Runtime mirror of the compile-time check above: the provider seam is
    // driven exactly like the route will drive it.
    const provider: TtsProvider = {
      async synthesize(text: string, opts: TtsSynthesisOptions): Promise<SynthesizedAudio> {
        expect(text).toBeTypeOf("string");
        expect(["pt-BR", "en"]).toContain(opts.locale);
        return { format: "audio/mpeg", audio: new Uint8Array([1, 2, 3]) };
      },
    };

    const request: NarrateRequest = { sceneText: "Era uma vez…", locale: "pt-BR" };
    const audio = await provider.synthesize(request.sceneText, { locale: request.locale });

    expect(audio.format).toBe("audio/mpeg");
    expect(audio.audio).toBeInstanceOf(Uint8Array);
  });

  it("TtsProviderError kinds map 1:1 to the narration contract codes", () => {
    const kinds = [
      "unavailable",
      "timeout",
      "invalid",
      "over_limit",
    ] as const satisfies readonly TtsProviderErrorKind[];

    for (const kind of kinds) {
      expect(kindToContractCode[kind]).toBeTypeOf("string");
    }
    // Every kind is a valid contract-relevant code (never an unknown string).
    const contractCodes = [
      "invalid_input",
      "unsupported_locale",
      "narration_unavailable",
      "narration_timeout",
      "rate_limited",
    ];
    expect(contractCodes).toContain(kindToContractCode.unavailable);
    expect(contractCodes).toContain(kindToContractCode.timeout);
    expect(contractCodes).toContain(kindToContractCode.invalid);
    expect(contractCodes).toContain(kindToContractCode.over_limit);
  });

  it("TtsProviderError is a typed, transport-agnostic error", () => {
    const error = new TtsProviderError({ kind: "unavailable", message: "boom" });
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("unavailable");
    expect(error.message).toBe("boom");

    const typed: TtsProviderErrorKind = error.kind;
    expect(typed).toBe("unavailable");
  });
});
