import nextra from 'nextra'

const withNextra = nextra({
  // contentDirBasePath defaults to 'content'
})

export default withNextra({
  // Serve under www.vivereply.com/docs via rewrite from the main site
  basePath: '/docs',
})
