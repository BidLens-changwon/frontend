const API_FIELD_TO_FORM_FIELD = {
  mode: 'mode',
  as_of: 'asOf',
  top_k: 'topK',
  'draft.notice_id': 'noticeId',
  'draft.notice_round': 'noticeRound',
  'draft.title': 'title',
  'draft.bid_method': 'bidMethod',
  'draft.organization': 'organization',
  'draft.contract_method': 'contractMethod',
  'draft.award_method': 'awardMethod',
  'draft.service_type': 'serviceType',
  'draft.procurement_class_name': 'procurementClassName',
  'draft.procurement_class_code': 'procurementClassCode',
  'draft.estimated_price_krw': 'estimatedPriceKrw',
  'draft.budget_krw': 'budgetKrw',
  'draft.bid_start_at': 'bidStartAt',
  'draft.bid_close_at': 'bidCloseAt',
  'draft.industry_restricted': 'industryRestricted',
  'draft.joint_region_restricted': 'jointRegionRestricted',
  'draft.registration_restricted': 'registrationRestricted',
  'draft.vat_krw': 'vatKrw',
  'draft.attachment_count': 'attachmentCount',
} as const

export type DraftReviewFormField =
  (typeof API_FIELD_TO_FORM_FIELD)[keyof typeof API_FIELD_TO_FORM_FIELD]

export const getDraftReviewFormField = (apiField: string) =>
  API_FIELD_TO_FORM_FIELD[apiField as keyof typeof API_FIELD_TO_FORM_FIELD] ??
  null
