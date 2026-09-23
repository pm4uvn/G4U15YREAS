import gsap from 'gsap'

gsap.defaults({ ease: 'power3.out', duration: 0.9 })
gsap.ticker.lagSmoothing(0)

export { gsap }
