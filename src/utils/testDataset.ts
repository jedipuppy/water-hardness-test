import { ACTIVE_SAMPLES, TRUE_ORDER } from '../config'
import type { EstimatedHardnessMap, Submission, SampleId } from '../types'

interface GeneratorOptions {
  count?: number
  correctRatio?: number
  mildErrorRatio?: number
}

const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  count: 100,
  correctRatio: 0.35,
  mildErrorRatio: 0.4,
}

const TEST_COMMENTS = [
  '測定値は概ね想定範囲内でした。',
  '標準液との比較で若干高めに出ています。',
  '色の変化が見づらく反応時間を延長しました。',
  '試薬の滴下回数を多めに調整しました。',
  '攪拌不足が誤差の原因かもしれません。',
  '前回より硬度が下がったように感じました。',
  'サンプル温度が常温より低めでした。',
  '滴定終了の色がやや曖昧でした。',
  '採水直後に気泡が多く混入しました。',
  '硬度指標にわずかな濁りがありました。',
  '測定器の校正を直前に実施しました。',
  '試薬の消費量が予想より少なかったです。',
  '硬度の変化が顕著で判定しやすかったです。',
  '試験紙と滴定の結果が一致しました。',
  '開始時に試薬瓶を十分に振りました。',
  '目標指示色へ達するまで時間がかかりました。',
  '前処理のろ過を念入りに行いました。',
  '採水容器を事前に洗浄済みです。',
  '観測データに大きな外れ値は見られません。',
  '同一サンプルで二重測定を実施しました。',
  '硬度は過去平均と同程度でした。',
  '測定環境は室温23℃でした。',
  '滴下間隔を一定に保つよう注意しました。',
  '反応開始後すぐに色変化が現れました。',
  '試薬残量が少なく追加ボトルを使用しました。',
  '硬度結果に信頼度高と評価します。',
  'サンプルのpHが若干高めでした。',
  '硬度値が閾値付近で安定しています。',
  '前処理の時間を通常より短縮しました。',
  '測定器のバッテリー残量は十分です。',
  '滴定時に泡立ちが少し発生しました。',
  '混合時に磁気スターラーを使用しました。',
  '照明条件は蛍光灯下でした。',
  '硬度が標準偏差内に収まりました。',
  '測定の途中で小休止を入れました。',
  'サンプル番号を再確認済みです。',
  '色見本と比較して判断しました。',
  '手袋を着用し外部混入を防ぎました。',
  '流水での洗浄後に測定しました。',
  '採水後30分以内に分析しました。',
  '硬度のばらつきは小さく安定しています。',
  '分析手順書に従い実施しました。',
  '滴定終点を二人で確認しました。',
  '硬度変化が緩やかで見極めが難しかったです。',
  '測定カップに微細な沈殿がありました。',
  'サンプル保存温度は5℃でした。',
  '硬度は基準値をわずかに超えています。',
  '攪拌時間を通常より長めに取りました。',
  '測定値が前回よりも大きな差です。',
  '滴定試薬の有効期限を確認済みです。',
  '硬度が非常に低くほぼ軟水です。',
  '硬度が非常に高く補正を検討してください。',
  '色の変化が急で終点を逃しそうでした。',
  '測定前に白紙試験を行いました。',
  '採水地点の天候は晴れでした。',
  '硬度は設備運転条件と整合しています。',
  '測定器の温度補正機能を使用しました。',
  '滴下速度を毎秒一滴で統一しました。',
  '硬度評価に自信がありません。',
  '測定途中で記録を一度中断しました。',
  '硬度が高めなので再測定を推奨します。',
  '採水容器の蓋が固く開封に時間を要しました。',
  '反応が遅かったため軽く加温しました。',
  '硬度が基準より低下傾向にあります。',
  '試薬の色素が沈殿していたため攪拌しました。',
  '測定者は本テストが初めてです。',
  '硬度は過去データよりばらつき大です。',
  '結果は他の測定方法とも一致しました。',
  '滴定容器にキズがあり目視しづらかったです。',
  '硬度計の表示値と整合性良好です。',
  'サンプルの匂いがやや強かったです。',
  '測定結果が想定以上にクリアでした。',
  '硬度の指標液を少量追加しました。',
  '測定メモを詳細に記録しました。',
  '硬度が高いため希釈案も検討しています。',
  '操作手順の確認に追加時間を使いました。',
  '硬度値の変動が小さく信頼できそうです。',
  '測定器のセンサーを清掃済みです。',
  '硬度が上限値に近づいています。',
  '採水地点が前回と異なります。',
  '硬度が低いため再度滴定しました。',
  '反応が早すぎて終点判断が難しかったです。',
  '測定前にサンプルを静置しました。',
  '硬度がほぼ中央値に一致しています。',
  '試薬量を誤って多く入れました。',
  '硬度値に不自然な揺らぎを感じました。',
  '測定器の表示が一瞬フリーズしました。',
  '硬度の判定を先輩に確認しました。',
  '測定中に軽微な振動がありました。',
  '硬度の結果に再現性があります。',
  'サンプル番号のラベルが剥がれかけていました。',
  '硬度は管理基準内に収まり安心しました。',
  '滴定前にサンプルを軽く撹拌しました。',
  '硬度変化をグラフ化して保管しました。',
  '測定後に器具を即洗浄しました。',
  '硬度が高いのでカルシウム析出に注意してください。',
  '測定中に電話応対が入り再開しました。',
  '硬度計の電池を新品に交換しました。',
  '硬度評価を二名でクロスチェックしました。',
'測定結果をデータベースに登録済みです。',
] as const;

const SAMPLE_IDS = ['S0001', 'S0002', 'S0003', 'S0004', 'S0005']
const HARDNESS_INDEX = new Map(
  ACTIVE_SAMPLES.map((sample) => [sample.id, sample.hardness]),
)

export function generateTestDataset(
  options: GeneratorOptions = {},
): Submission[] {
  const { count, correctRatio, mildErrorRatio } = {
    ...DEFAULT_GENERATOR_OPTIONS,
    ...options,
  }

  const datasetCount = count ?? 0
  const now = Date.now()
  const submissions: Submission[] = []

  for (let index = 0; index < datasetCount; index += 1) {
    const order = createOrder(correctRatio ?? 0.35, mildErrorRatio ?? 0.4)
    const estimatedHardness = createEstimatedHardness()
    const comment =
      TEST_COMMENTS[index % TEST_COMMENTS.length] ?? TEST_COMMENTS[0]
    submissions.push({
      id: `test-${index + 1}`,
      studentId: SAMPLE_IDS[index % SAMPLE_IDS.length],
      order,
      timestamp: now - (datasetCount - index) * 60 * 1000,
      estimatedHardness,
      comment,
    })
  }

  return submissions
}

function createOrder(correctRatio: number, mildErrorRatio: number): SampleId[] {
  const coin = Math.random()
  if (coin < correctRatio) {
    return [...TRUE_ORDER]
  }
  if (coin < correctRatio + mildErrorRatio) {
    return applyLocalSwap(TRUE_ORDER)
  }
  return shuffle([...TRUE_ORDER])
}

function applyLocalSwap(order: SampleId[]): SampleId[] {
  const result = [...order]
  const firstIndex = Math.floor(Math.random() * result.length)
  const secondIndex = clampIndex(
    firstIndex + (Math.random() > 0.5 ? 1 : -1),
    result.length,
  )
  swap(result, firstIndex, secondIndex)
  if (Math.random() > 0.7) {
    const extraFirst = Math.floor(Math.random() * result.length)
    const extraSecond = clampIndex(
      extraFirst + (Math.random() > 0.5 ? 1 : -1),
      result.length,
    )
    swap(result, extraFirst, extraSecond)
  }
  return result
}

function shuffle(order: SampleId[]): SampleId[] {
  const result = [...order]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    swap(result, i, j)
  }
  return result
}

function swap<T>(array: T[], first: number, second: number): void {
  const temp = array[first]
  array[first] = array[second]
  array[second] = temp
}

function clampIndex(index: number, length: number): number {
  if (index < 0) {
    return 0
  }
  if (index >= length) {
    return length - 1
  }
  return index
}

function createEstimatedHardness(): EstimatedHardnessMap {
  const map: EstimatedHardnessMap = {}
  ACTIVE_SAMPLES.forEach((sample) => {
    const actual = HARDNESS_INDEX.get(sample.id) ?? 0
    const noise = randomNormal(0, Math.max(5, actual * 0.12))
    const estimate = Math.max(0, actual + noise)
    map[sample.id] = Math.round(estimate * 10) / 10
  })
  return map
}

function randomNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const magnitude = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + magnitude * stdDev
}
