import { describe, expect, it } from 'vitest'
import {
  CAPTION_MAX,
  describeVehicle,
  listServices,
  renderCaptionTemplate,
  suggestCaption,
  withHashtags,
} from '@/lib/captions'

describe('renderCaptionTemplate', () => {
  it('substitutes tokens', () => {
    const out = renderCaptionTemplate('{{vehicle}} in for {{services}} at {{business}}!', {
      vehicle: 'Black 2023 BMW M340i',
      services: 'Full Detail',
      business: 'Suds',
    })
    expect(out).toBe('Black 2023 BMW M340i in for Full Detail at Suds!')
  })

  it('drops unknown tokens without leaving holes', () => {
    const out = renderCaptionTemplate('Hi {{customer}}, your {{nope}} shines.', { customer: 'Sam' })
    expect(out).toBe('Hi Sam, your shines.')
  })

  it('tolerates whitespace inside braces', () => {
    expect(renderCaptionTemplate('{{ city }}', { city: 'Cincy' })).toBe('Cincy')
  })
})

describe('describeVehicle', () => {
  it('joins the parts that exist', () => {
    expect(describeVehicle({ color: 'White', year: 2021, make: 'Tesla', model: 'Model 3' })).toBe(
      'White 2021 Tesla Model 3',
    )
    expect(describeVehicle({ make: 'Jeep', model: 'Wrangler' })).toBe('Jeep Wrangler')
    expect(describeVehicle({ color: '', year: null, make: 'Ford', model: 'F-150' })).toBe(
      'Ford F-150',
    )
  })
})

describe('listServices', () => {
  it('reads like prose', () => {
    expect(listServices([])).toBe('')
    expect(listServices(['Full Detail'])).toBe('Full Detail')
    expect(listServices(['Full Detail', 'Pet Hair Removal'])).toBe('Full Detail + Pet Hair Removal')
    expect(listServices(['A', 'B', 'C'])).toBe('A, B + C')
  })
})

describe('suggestCaption', () => {
  const context = {
    vehicle: 'White 2021 Tesla Model 3',
    vehicleShort: 'Tesla Model 3',
    services: 'Full Detail',
    city: 'Cincinnati, OH',
  }

  it('is deterministic for the same input', () => {
    expect(suggestCaption(context)).toBe(suggestCaption(context))
  })

  it('mentions the work and ends with a booking call-to-action', () => {
    const caption = suggestCaption(context)
    expect(caption).toContain('Full Detail')
    expect(caption).toContain('Cincinnati, OH')
    expect(caption).toContain('link in bio')
  })

  it('falls back to a generic CTA without a city', () => {
    expect(suggestCaption({ ...context, city: '' })).toContain('Book your detail — link in bio.')
  })
})

describe('withHashtags', () => {
  it('appends the bank on its own block and normalises # prefixes', () => {
    expect(withHashtags('Shine.', 'detailing #cincy')).toBe('Shine.\n\n#detailing #cincy')
  })

  it('is a no-op with an empty bank', () => {
    expect(withHashtags('Shine.', '  ')).toBe('Shine.')
  })
})

it('caption ceiling matches Instagram', () => {
  expect(CAPTION_MAX).toBe(2200)
})
