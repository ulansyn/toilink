

document.addEventListener('DOMContentLoaded', () => {
    if (window.WEDDING_CONFIG && window.WEDDING_CONFIG.options && window.WEDDING_CONFIG.options.enableSecurity === false) {
        return;
    }
    document.addEventListener('selectstart', e => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    document.addEventListener('dragstart', e => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });


    document.addEventListener('contextmenu', e => e.preventDefault());


    document.addEventListener('keydown', e => {
        if (

            e.key === 'F12' ||

            ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||

            ((e.ctrlKey || e.metaKey) && e.key === 'U') ||

            (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'U')) ||

            ((e.ctrlKey || e.metaKey) && e.key === 'C')
        ) {
            e.preventDefault();
            return false;
        }
    });


    const style = document.createElement('style');
    style.innerHTML = `
        body {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-user-drag: none;
        }
        input, textarea {
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            user-select: text;
        }
    `;
    document.head.appendChild(style);


    setInterval(() => {
        Function('debugger')();
    }, 500);
});
