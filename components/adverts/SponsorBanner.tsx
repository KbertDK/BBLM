'use client'

import { useEffect, useState } from 'react'
import SectionHeading from '@/components/ui/SectionHeading'

const ADVERTS = [
  '/adverts/7-Elven.jpg',
  '/adverts/abc.jpg',
  '/adverts/AirJordell.gif',
  '/adverts/BlockDodger.jpg',
  '/adverts/Bloodweiser.jpg',
  '/adverts/BoneheadedVideo.jpg',
  '/adverts/Bony.jpg',
  '/adverts/Cannon.jpg',
  '/adverts/Chanelf.jpg',
  '/adverts/ChoppersThugMart.jpg',
  '/adverts/DedBull.jpg',
  '/adverts/Dodge.jpg',
  '/adverts/Elf.jpg',
  '/adverts/Festers.jpg',
  '/adverts/Fjord.jpg',
  '/adverts/Foul.jpg',
  '/adverts/Frenzy.jpg',
  '/adverts/getref.gif',
  '/adverts/Gobbostopper.jpg',
  '/adverts/griffmovie.gif',
  '/adverts/Hurtz.jpg',
  '/adverts/Ikillya.jpg',
  '/adverts/Insanesburys.jpg',
  '/adverts/Jordell.jpg',
  '/adverts/Killers.jpg',
  '/adverts/Killtucky.jpg',
  '/adverts/Knuckleduster.jpg',
  '/adverts/McMutys.jpg',
  '/adverts/MGD.jpg',
  '/adverts/MightyBlow.jpg',
  '/adverts/MightyBlow-1.jpg',
  '/adverts/Nesquig.jpg',
  '/adverts/Ogre.jpg',
  '/adverts/OgreGuardian.jpg',
  '/adverts/orcacola.gif',
  '/adverts/Orcarade.jpg',
  '/adverts/orcidas.jpg',
  '/adverts/Orcsmobile.jpg',
  '/adverts/Orcswagon.jpg',
  '/adverts/orcwagen2.gif',
  '/adverts/Painasonic.jpg',
  '/adverts/Reeborc.jpg',
  '/adverts/Sabol.jpg',
  '/adverts/Scabidas.jpg',
  '/adverts/spikey.jpg',
  '/adverts/squigger.gif',
]

const N = ADVERTS.length

function randomIndex() {
  return Math.floor(Math.random() * N)
}

function useRotatingSlot(intervalMs: number) {
  const [index,   setIndex]   = useState(randomIndex)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1 + Math.floor(Math.random() * (N - 1))) % N)
        setVisible(true)
      }, 350)
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return { index, visible }
}

export default function SponsorBanner() {
  const slot0 = useRotatingSlot(5000)
  const slot1 = useRotatingSlot(6500)
  const slot2 = useRotatingSlot(8000)

  const slots = [slot0, slot1, slot2]

  return (
    <section>
      <SectionHeading
        title="Official League Sponsors"
        subtitle="Proud supporters of violence, mayhem, and questionable sportsmanship"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.map(({ index, visible }, i) => (
          <div
            key={i}
            className="bg-bb-darker border border-bb-border/50 rounded-sm overflow-hidden flex items-center justify-center h-48"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}
          >
            <img
              src={ADVERTS[index]}
              alt="league sponsor"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
