import { hasAppAccess, isAdminRole, ASSIGNABLE_ROLES } from './roles'

describe('hasAppAccess', () => {
  it('denies undefined (no claim = PENDING)', () => {
    expect(hasAppAccess(undefined)).toBe(false)
  })

  it('denies PENDING', () => {
    expect(hasAppAccess('PENDING')).toBe(false)
  })

  it('allows USER', () => {
    expect(hasAppAccess('USER')).toBe(true)
  })

  it('allows ADMIN', () => {
    expect(hasAppAccess('ADMIN')).toBe(true)
  })

  it('allows SUPERADMIN', () => {
    expect(hasAppAccess('SUPERADMIN')).toBe(true)
  })
})

describe('isAdminRole', () => {
  it('denies undefined, PENDING, and USER', () => {
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole('PENDING')).toBe(false)
    expect(isAdminRole('USER')).toBe(false)
  })

  it('allows ADMIN and SUPERADMIN', () => {
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('SUPERADMIN')).toBe(true)
  })
})

describe('ASSIGNABLE_ROLES', () => {
  it('excludes SUPERADMIN — it can never be granted through the app', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('SUPERADMIN')
  })

  it('includes PENDING, USER, and ADMIN', () => {
    expect(ASSIGNABLE_ROLES).toEqual(expect.arrayContaining(['PENDING', 'USER', 'ADMIN']))
  })
})
