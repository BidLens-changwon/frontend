export const M4_SCHEMA_VERSION = 'm4-review-v1' as const

export type M4SchemaVersion = typeof M4_SCHEMA_VERSION
export type ReviewMode = 'current' | 'replay'
export type IsoDateTime = string

export interface DraftReviewInput {
  notice_id: string | null
  notice_round: string | null
  title: string
  bid_method: '전자입찰' | '직찰' | '전자시담'
  organization: string
  contract_method: string
  award_method: string
  service_type: string
  procurement_class_name: string
  procurement_class_code: string | null
  estimated_price_krw: number | null
  budget_krw: number | null
  bid_start_at: IsoDateTime
  bid_close_at: IsoDateTime
  industry_restricted: boolean | null
  joint_region_restricted: boolean | null
  registration_restricted: boolean | null
  vat_krw: number | null
  attachment_count: number | null
}
