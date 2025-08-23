import { gsap } from 'gsap';

gsap.to('.hero', { 
    duration: 1.5, 
    opacity: 1, 
    y: 0, 
    ease: 'power3.out',
    delay: 0.2
});
