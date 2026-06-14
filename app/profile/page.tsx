import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { updateProfile } from './actions'

export const dynamic = 'force-dynamic'

function inputCls(extra = '') {
  return `w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function Field({
  label, name, type = 'text', defaultValue, required, placeholder, hint,
}: {
  label: string; name: string; type?: string; defaultValue?: string | null
  required?: boolean; placeholder?: string; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
        {label}{required && <span className="text-bb-crimson-bright ml-1">*</span>}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder={placeholder}
        className={inputCls()}
      />
      {hint && <p className="text-bb-muted/40 text-xs">{hint}</p>}
    </div>
  )
}

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({
    where:  { id: session.coachId },
    select: { name: true, alias: true, email: true, phone: true, address: true, zip: true, city: true },
  })
  if (!coach) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="mb-10">
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-1">
            My Profile
          </h1>
          <p className="text-bb-muted text-sm">Update your personal information and contact details.</p>
        </div>

        <form action={updateProfile} className="space-y-8">

          {/* Coach identity */}
          <div className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-5">
            <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
              Coach Identity
            </h2>
            <Field
              label="Coach Alias" name="alias" required
              defaultValue={coach.alias}
              placeholder="e.g. GrimTusk_88"
              hint="Your public name — the only thing other coaches can see."
            />
          </div>

          {/* Contact */}
          <div className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-5">
            <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
              Contact Information
            </h2>
            <Field
              label="Email" name="email" type="email" required
              defaultValue={coach.email}
              placeholder="you@example.com"
            />
            <Field
              label="Phone" name="phone" type="tel" required
              defaultValue={coach.phone}
              placeholder="+45 12 34 56 78"
            />
          </div>

          {/* Personal */}
          <div className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-5">
            <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
              Personal Information
            </h2>
            <Field
              label="Full Name" name="name"
              defaultValue={coach.name}
              placeholder="Your real name (private)"
            />
            <Field
              label="Address" name="address"
              defaultValue={coach.address}
              placeholder="Street and number"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Zip Code" name="zip"
                defaultValue={coach.zip}
                placeholder="1234"
              />
              <Field
                label="City" name="city"
                defaultValue={coach.city}
                placeholder="Copenhagen"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-sm py-3 px-6 rounded-sm transition-colors"
          >
            Save Changes
          </button>
        </form>

      </div>
    </div>
  )
}
