import { getSession } from '@/lib/auth'
import { getGalleryPosts } from '@/lib/queries/gallery'
import SectionHeading from '@/components/ui/SectionHeading'
import GalleryUploadForm from './GalleryUploadForm'

export const revalidate = 0

const PODCAST_DIR = '/Podcast/Tackle Zone Radio'

const episodes = [
  { file: 'TZR000.mp3', title: 'Tackle Zone Radio #000 – Beginners Guide' },
  { file: 'TZR001.mp3', title: 'Tackle Zone Radio #001 – The Kick Off' },
  { file: 'TZR002.mp3', title: 'Tackle Zone Radio #002 – Know Your Role' },
  { file: 'TZR003.mp3', title: 'Tackle Zone Radio #003 – Entering in to a new age' },
  { file: 'TZR004.mp3', title: 'Tackle Zone Radio #004 – What Is Wrong with deodorant!' },
]

export default async function HobbyPage() {
  const [session, posts] = await Promise.all([
    getSession(),
    getGalleryPosts(),
  ])

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <SectionHeading title="Hobby" subtitle="Beyond the pitch — the stories, the paint, the people" />

        {/* ── Intro text ──────────────────────────────────────────────── */}
        <div className="grimdark-card px-6 py-8 sm:px-10 sm:py-10 mb-16 space-y-5 text-bb-muted leading-relaxed">
          <h2 className="font-heading text-xl font-bold text-bb-gold uppercase tracking-wide mb-2">
            Why Blood Bowl Is More Than a Game
          </h2>
          <p>
            Blood Bowl is about building a team that feels alive, with heroes, rivalries, and scars.
            Every match adds a new chapter to your team&rsquo;s story.
          </p>
          <p>
            <b className="text-white">Dive into the fluff.</b> Explore a gloriously chaotic fantasy sports
            world full of Orcs, Elves, Dwarfs, Skaven, bribed referees, and bloodthirsty fans.
          </p>
          <p>
            <b className="text-white">Find your play style.</b> Bash, dodge, pass, or embrace pure chaos.
            How you play gives your team its personality.
          </p>
          <p>
            <b className="text-white">Watch your players grow.</b> Rookies earn skills and become legends,
            and every loss of a veteran truly hurts.
          </p>
          <p>
            <b className="text-white">Give them a story.</b> Name your players, give them quirks and
            grudges, and turn miniatures into characters you care about.
          </p>
          <p>
            <b className="text-white">Write your team&rsquo;s saga.</b> Last-turn comebacks, bitter
            rivalries, and unforgettable touchdowns become stories your league retells for years.
          </p>
          <p>
            <b className="text-white">Paint your colours.</b> Design your own kit and details, and feel
            the pride of fielding a team that is truly yours.
          </p>
          <p className="text-white font-semibold">
            Grab a team. Name your players. Paint your colours. Your legend starts now.
          </p>
          <p className="text-bb-gold/80 italic pt-2 border-t border-bb-border/40">
            Dive in here and feel free to share.
          </p>
        </div>

        {/* ── Gallery ─────────────────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="font-heading text-2xl font-bold text-bb-gold uppercase tracking-widest text-center mb-6">
            🖼 Gallery
          </h2>

          {session && (
            <div className="max-w-md mx-auto mb-8">
              <GalleryUploadForm />
            </div>
          )}

          {posts.length === 0 ? (
            <p className="text-bb-muted text-sm italic text-center">No pictures shared yet — be the first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post) => (
                <div key={post.id} className="bg-bb-dark border border-bb-border rounded-sm overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt={post.description} className="w-full h-48 object-cover" />
                  <div className="p-4">
                    <p className="text-sm text-white leading-snug mb-2">{post.description}</p>
                    <p className="text-[11px] text-bb-muted/60">
                      by {post.coach.alias ?? post.coach.name} · {post.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── OldCast ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="font-heading text-2xl font-bold text-bb-gold uppercase tracking-widest text-center mb-6">
            🎙 OldCast
          </h2>
          <div className="flex flex-col items-center gap-4 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={encodeURI(`${PODCAST_DIR}/Folder.jpg`)}
              alt="Tackle Zone Radio"
              className="w-40 h-40 object-contain rounded-sm border border-bb-border"
            />
            <p className="text-bb-muted text-sm text-center max-w-md">
              Five episodes of Tackle Zone Radio, kept here for posterity.
            </p>
          </div>
          <div className="space-y-4 max-w-2xl mx-auto">
            {episodes.map((ep) => (
              <div key={ep.file} className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
                <p className="text-sm text-white mb-2">{ep.title}</p>
                <audio controls className="w-full" src={encodeURI(`${PODCAST_DIR}/${ep.file}`)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
