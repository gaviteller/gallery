import type { NSFWJS, PredictionType } from "nsfwjs"

export type NsfwClass = "Drawing" | "Hentai" | "Neutral" | "Porn" | "Sexy"
export type NsfwScores = Record<NsfwClass, number>
export type NsfwVerdict = "SAFE" | "SUGGESTIVE" | "EXPLICIT"

const EMPTY_SCORES: NsfwScores = {
  Drawing: 0,
  Hentai: 0,
  Neutral: 0,
  Porn: 0,
  Sexy: 0,
}

let modelPromise: Promise<NSFWJS> | null = null

async function getModel(): Promise<NSFWJS> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs-backend-cpu")
      const tf = await import("@tensorflow/tfjs")
      await tf.setBackend("cpu")
      await tf.ready()
      const nsfw = await import("nsfwjs")
      return nsfw.load()
    })()
  }
  return modelPromise
}

function decodeBase64(input: string): Buffer | null {
  const raw = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input
  if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) return null
  const buffer = Buffer.from(raw, "base64")
  return buffer.length > 0 ? buffer : null
}

export async function scanImage(input: string): Promise<NsfwScores | null> {
  try {
    const buffer = decodeBase64(input)
    if (!buffer) return null

    const [{ default: Jimp }, tf, model] = await Promise.all([
      import("jimp"),
      import("@tensorflow/tfjs"),
      getModel(),
    ])
    const image = await Jimp.read(buffer)
    const rgba = tf.tensor3d(
      new Uint8Array(image.bitmap.data),
      [image.bitmap.height, image.bitmap.width, 4],
      "int32"
    )
    const rgb = rgba.slice([0, 0, 0], [-1, -1, 3])

    try {
      const predictions = await model.classify(rgb, 5)
      return predictions.reduce<NsfwScores>((scores, prediction: PredictionType) => {
        if (prediction.className in scores) {
          scores[prediction.className as NsfwClass] = prediction.probability
        }
        return scores
      }, { ...EMPTY_SCORES })
    } finally {
      rgba.dispose()
      rgb.dispose()
    }
  } catch {
    return null
  }
}

export function getVerdict(scores: NsfwScores): NsfwVerdict {
  const explicit = scores.Porn + scores.Hentai
  if (scores.Porn >= 0.8 || scores.Hentai >= 0.8 || explicit >= 0.8) return "EXPLICIT"
  if (explicit >= 0.5 || scores.Sexy >= 0.5) return "SUGGESTIVE"
  return "SAFE"
}
