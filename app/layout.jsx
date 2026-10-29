import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'Vivereply Documentation',
    template: '%s | Vivereply Docs'
  },
  description:
    'Documentation for everything Vivereply: the Suite (Resort PMS) training manual, the Concierge front-desk agent, and Vivereply Chat.'
}

const navbar = (
  <Navbar
    logo={
      <span style={{ fontWeight: 700 }}>
        Vivereply <span style={{ fontWeight: 400 }}>Docs</span>
      </span>
    }
  />
)

const footer = (
  <Footer>
    MIT {new Date().getFullYear()} © ViveScript Solutions LLC. — docs.vivereply.com
  </Footer>
)

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/swopno1/vivereply-documentation/blob/main"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
