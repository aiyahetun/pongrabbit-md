/**
 * 可视化模式图片块（M4）：figure.image-block
 */
;(function (root, factory) {
  root.pongrabbitImageWidget = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  function shouldSkipImg (img) {
    if (!img || img.tagName !== 'IMG') return true
    if (img.closest('.image-block, .diagram-block, a')) return true
    return false
  }

  function upgradeImgToImageBlock (img) {
    if (shouldSkipImg(img)) return
    const fig = (img.ownerDocument || root.document).createElement('figure')
    fig.className = 'image-block'
    fig.contentEditable = 'false'
    const parent = img.parentElement
    if (!parent) return
    parent.replaceChild(fig, img)
    fig.appendChild(img)
    if (parent.tagName === 'P' && parent.childElementCount === 1) {
      parent.replaceWith(fig)
    }
  }

  function upgradeImagesInRichEditor (container) {
    if (!container) return
    const imgs = Array.from(container.querySelectorAll('img'))
    for (const img of imgs) upgradeImgToImageBlock(img)
  }

  function buildImageBlock (fileUrl, mdRel, alt) {
    const doc = root.document
    const fig = doc.createElement('figure')
    fig.className = 'image-block'
    fig.contentEditable = 'false'
    const img = doc.createElement('img')
    img.setAttribute('src', fileUrl)
    img.setAttribute('alt', alt || '')
    if (mdRel) img.setAttribute('data-md-src', mdRel)
    fig.appendChild(img)
    return fig
  }

  function imageBlockToMd (fig) {
    const img = fig.querySelector('img')
    if (!img) return ''
    const mdSrc = img.getAttribute('data-md-src') || img.getAttribute('src') || ''
    const alt = img.getAttribute('alt') || ''
    return '![' + alt + '](' + mdSrc + ')'
  }

  return {
    upgradeImgToImageBlock,
    upgradeImagesInRichEditor,
    buildImageBlock,
    imageBlockToMd
  }
})
