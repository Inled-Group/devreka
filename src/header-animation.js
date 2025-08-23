document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const headerHeight = header.offsetHeight;

    window.addEventListener('scroll', () => {
        if (window.scrollY > headerHeight) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
});
