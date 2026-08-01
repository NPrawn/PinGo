/**
 * Icon sprite extracted from the PinGo prototype.
 *
 * The prototype inlined 44 `<symbol>` definitions and referenced them with
 * `<use href="#i-*">`. `IconSprite` renders those definitions once at the app
 * root; `Icon` references them by a typed name.
 *
 * Generated from the prototype markup — edit the sprite here, not in the HTML.
 */

export function IconSprite() {
  return (
    <svg width={0} height={0} aria-hidden focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {/* 인형뽑기 기계. 집게만 그리면 램프로 읽혀서 기계 몸통까지 그린다. */}
        <symbol id="i-arcade" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M3.4 2.6h17.2v18.8H3.4V2.6Zm2.2 2.2v14.4h12.8V4.8H5.6Zm5.3 0h2.2v3.6h-2.2V4.8ZM8.4 8.4h7.2l-1.4 2.8H9.8L8.4 8.4Zm3.6 4.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"
          />
        </symbol>
        <symbol id="i-arrow-right" viewBox="0 0 24 24">
          <path
            d="M3.4 12h16.2M13.6 5.8 20 12l-6.4 6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        </symbol>
        <symbol id="i-bolt" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M14.4 1.6 3.6 14.8h6.2l-1 7.6 9.6-12.2h-6.1l2.1-8.6Z" />
        </symbol>
        <symbol id="i-bottle" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M10.4 1.6h3.2v2.2h-3.2V1.6ZM8.6 6.4h6.8v16H8.6v-16Zm2.2-1.4h2.4v1.4h-2.4V5Zm-2.2 6.4h6.8v1.6H8.6v-1.6Z"
          />
        </symbol>
        <symbol id="i-building" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.8 2.4h11.8v8.4h6.6v11.6H2.8V2.4Zm2.8 3.2v2.2h6.2V5.6H5.6Zm0 4.4v2.2h6.2V10H5.6Zm0 4.4v2.2h6.2v-2.2H5.6Zm11.4-1.4v2.2h2.2V13H17Z"
          />
        </symbol>
        <symbol id="i-bulb" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a7 7 0 0 0-4.2 12.6v2.8h8.4v-2.8A7 7 0 0 0 12 1.8ZM8.4 18.4h7.2v2.2H8.4v-2.2Zm1.4 3.4h4.4V23H9.8v-1.2Z"
          />
        </symbol>
        <symbol id="i-bus" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M3.4 2.8h17.2v13.6H3.4V2.8Zm2.2 2.2v4.4h5.2V5H5.6Zm7.6 0v4.4h5.2V5h-5.2Zm-6 6.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm9.6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM5.2 17.8h3l-1.8 3.6H2.8l2.4-3.6Zm10.6 0 2.4 3.6h-3.6l-1.8-3.6h3Z"
          />
        </symbol>
        <symbol id="i-camera" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M8.1 2.6h7.8l1.6 3.1H22v15.7H2V5.7h4.5l1.6-3.1ZM12 18.9a5.4 5.4 0 1 0 0-10.8 5.4 5.4 0 0 0 0 10.8Zm0-2.7a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z"
          />
        </symbol>
        <symbol id="i-card" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.4 4.6h19.2v14.8H2.4V4.6Zm2.2 2.2v2h14.8v-2H4.6Zm0 6.2v2h5v-2h-5Z"
          />
        </symbol>
        <symbol id="i-chart" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 20.2h18.8v2.2H2.6v-2.2Zm2.2-9.6h3.4v8.4H4.8v-8.4Zm5.6-7.8h3.4v16.2h-3.4V2.8Zm5.6 10.6h3.4v5.6h-3.4v-5.6Z"
          />
        </symbol>
        <symbol id="i-chat" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 3h18.8v13.8H9.5L2.6 21.8V3Zm4.6 4.4v2.2h9.6V7.4H7.2Zm0 4.2v2.2h6V11.6h-6Z"
          />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path
            d="M3.8 12.4 9.4 18 20.2 6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm1.2 4.4v5.2l4 2.4-1.2 2-4.9-2.9V6.2h2.1Z"
          />
        </symbol>
        <symbol id="i-coffee" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.8 6.6h14.4v2.2h2.4a3.4 3.4 0 0 1 0 6.8h-2.6a5.8 5.8 0 0 1-5.6 4.2H8.4a5.6 5.6 0 0 1-5.6-5V6.6Zm14.4 4.4v2.4h2.4a1.2 1.2 0 0 0 0-2.4h-2.4ZM2.8 21.2h14.4v2.2H2.8v-2.2Z"
          />
        </symbol>
        <symbol id="i-compass" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm4.6 5.6-2.7 6.5-6.5 2.7 2.7-6.5 6.5-2.7Zm-4.6 3.3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z"
          />
        </symbol>
        <symbol id="i-cosmetics" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M10.4 2.6h3.2v6h1.8v14.2H8.6V8.6h1.8v-6Zm-1.8 9.8h6.8v1.6H8.6v-1.6Z"
          />
        </symbol>
        <symbol id="i-door" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M3.9 1.8h13.4v19.4h3.9v2.2H3v-2.2h.9V1.8Zm10.6 11.6v-2.8h-2.3v2.8h2.3Z"
          />
        </symbol>
        <symbol id="i-elevator" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 1.8h18.8v20.4H2.6V1.8Zm8.2 2.4H5v15.6h5.8V4.2Zm2.4 0v15.6H19V4.2h-5.8ZM8 6.2l-2.7 3.9h5.4L8 6.2Zm8 11.6 2.7-3.9h-5.4l2.7 3.9Z"
          />
        </symbol>
        <symbol id="i-eraser" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M14 4.2 3 15.2l5.6 5.6h2.6L22.2 9.8 14 4.2Zm-3.6 14.4-4-4 1.8-1.8 4 4-1.8 1.8Zm-2 2.2H22v2.2H8.4v-2.2Z"
          />
        </symbol>
        {/* 에스컬레이터. 계단(i-stairs)이 단면 계단이므로 발판이 있는 경사면으로 구분한다.
            홈이 없으면 그냥 화살표로 읽힌다. */}
        <symbol id="i-escalator" viewBox="0 0 24 24">
          <path
            d="M3.2 20.8h4L18 8.4M5.6 16.2l2.4 2.4M9.4 12.4l2.4 2.4M13.2 8.6l2.4 2.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        </symbol>
        {/* 환전기. 서로 반대로 향하는 두 화살표. i-swap은 세로 교환이라 층 이동에 쓰인다. */}
        <symbol id="i-exchange" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.8 6.4H15V3.4l6.2 4L15 11.4V8.6H2.8V6.4Zm18.4 9H9v-3l-6.2 4 6.2 4v-2.8h12.2v-2.2Z"
          />
        </symbol>
        {/* `eye`/`eye-off` are stroked outlines — added for password reveal
            toggles, which the prototype did not have. */}
        <symbol id="i-eye" viewBox="0 0 24 24">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.5 12S5.4 5 12 5s10.5 7 10.5 7-3.9 7-10.5 7S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3.1" />
          </g>
        </symbol>
        <symbol id="i-eye-off" viewBox="0 0 24 24">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.9 17.9A10.8 10.8 0 0 1 12 19.5C5.4 19.5 1.5 12 1.5 12a19.6 19.6 0 0 1 4.9-5.7" />
            <path d="M9.9 4.8A11.4 11.4 0 0 1 12 4.5c6.6 0 10.5 7.5 10.5 7.5a19.7 19.7 0 0 1-2.3 3.4" />
            <path d="M14.1 14.1a3.1 3.1 0 1 1-4.2-4.2" />
            <path d="M2.6 2.6l18.8 18.8" />
          </g>
        </symbol>
        <symbol id="i-flag" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M4.4 1.8h14.8l-3.4 5.2 3.4 5.2H6.6v10H4.4V1.8Z" />
        </symbol>
        {/* 개찰구. 양쪽 기둥과 사이를 막는 차단바. */}
        <symbol id="i-gate" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 5.4h6v13.2h-6V5.4Zm12.8 0h6v13.2h-6V5.4ZM9.8 10.6h4.4v2.8H9.8v-2.8Z"
          />
        </symbol>
        <symbol id="i-gear" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M10.2 1.6h3.6l.5 2.4 2.2.9 2-1.4 2.5 2.5-1.4 2 .9 2.2 2.4.5v3.6l-2.4.5-.9 2.2 1.4 2-2.5 2.5-2-1.4-2.2.9-.5 2.4h-3.6l-.5-2.4-2.2-.9-2 1.4-2.5-2.5 1.4-2-.9-2.2-2.4-.5v-3.6l2.4-.5.9-2.2-1.4-2 2.5-2.5 2 1.4 2.2-.9.5-2.4ZM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"
          />
        </symbol>
        <symbol id="i-globe" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm0 2.1c1.5 1.6 2.3 4.3 2.4 7h-4.8c.1-2.7.9-5.4 2.4-7ZM9.6 13h4.8c-.1 2.7-.9 5.4-2.4 7-1.5-1.6-2.3-4.3-2.4-7Zm7-2.1c-.1-2.2-.6-4.3-1.6-6.1a8.1 8.1 0 0 1 4.7 6.1h-3.1Zm3.1 2.1a8.1 8.1 0 0 1-4.7 6.1c1-1.8 1.5-3.9 1.6-6.1h3.1Zm-12.3 0c.1 2.2.6 4.3 1.6 6.1A8.1 8.1 0 0 1 4.3 13h3.1Zm-3.1-2.1A8.1 8.1 0 0 1 9 4.8c-1 1.8-1.5 3.9-1.6 6.1H4.3Z"
          />
        </symbol>
        <symbol id="i-gov" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2.2 22.2 9.4H1.8L12 2.2ZM4.2 10.8h2.6v8.8H4.2v-8.8Zm4.6 0h2.6v8.8H8.8v-8.8Zm4.6 0H16v8.8h-2.6v-8.8Zm4.6 0h2.6v8.8h-2.6v-8.8ZM2.4 21h19.2v2.2H2.4V21Z"
          />
        </symbol>
        <symbol id="i-headset" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2.2a8.6 8.6 0 0 0-8.6 8.6v2.2H2v7.4h5.4v-7.4H5.8v-2.2a6.2 6.2 0 0 1 12.4 0V13h-1.6v7.4h1.9c-.3 1.2-2.1 2-4.5 2v1.4c3.6 0 5.9-1.4 6.3-3.4H22V13h-1.4v-2.2A8.6 8.6 0 0 0 12 2.2Z"
          />
        </symbol>
        <symbol id="i-info" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm1.3 5.9a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Zm-.1 3.1h-2.4v6.9h2.4v-6.9Z"
          />
        </symbol>
        <symbol id="i-list" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M3.8 1.8h16.4v20.4H3.8V1.8Zm4 5.2v2.2h8.4V7h-8.4Zm0 4.2v2.2h8.4v-2.2h-8.4Zm0 4.2v2.2h5.4V15.4h-5.4Z"
          />
        </symbol>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a4.6 4.6 0 0 0-4.6 4.6v2.4H4.2v13h15.6v-13H16.6V6.4A4.6 4.6 0 0 0 12 1.8Zm0 2.4a2.2 2.2 0 0 1 2.2 2.2v2.4H9.8V6.4A2.2 2.2 0 0 1 12 4.2Zm-1.2 9h2.4v4.4h-2.4v-4.4Z"
          />
        </symbol>
        <symbol id="i-luggage" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M8.4 2.6h7.2v4.4h4.6v16H3.8V7h4.6V2.6Zm2.2 2.2v2.2h2.8V4.8h-2.8ZM11 9.6v11h2V9.6h-2Z"
          />
        </symbol>
        <symbol id="i-map" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 5.4 8.9 2.8v15.4L2.6 20.8V5.4Zm7.7 0v15.4l3.4 1.4V6.8l-3.4-1.4Zm4.8 1.4v15.4l6.3-2.6V4.2l-6.3 2.6Z"
          />
        </symbol>
        <symbol id="i-mic" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.6a3.5 3.5 0 0 0-3.5 3.5v6.3a3.5 3.5 0 0 0 7 0V5.1A3.5 3.5 0 0 0 12 1.6ZM4.6 10.7h2.6a4.8 4.8 0 0 0 9.6 0h2.6a7.4 7.4 0 0 1-6.1 7.2v2.2h3.3v2.4H7.4v-2.4h3.3v-2.2a7.4 7.4 0 0 1-6.1-7.2Z"
          />
        </symbol>
        <symbol id="i-note" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M4.2 1.8h10.2L19.8 7v15.2H4.2V1.8Zm10.2 2.6V7h2.6l-2.6-2.6ZM7.4 11.4v2.2h9.2v-2.2H7.4Zm0 4.2v2.2h6v-2.2h-6Z"
          />
        </symbol>
        <symbol id="i-pencil" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M16.4 2.6 20.8 7 9 18.8H4.6v-4.4L16.4 2.6Zm-2.2 3.6-8 8v1.4h1.4l8-8-1.4-1.4Z"
          />
        </symbol>
        <symbol id="i-person" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2.4a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 10.2c4.6 0 8.4 2.4 8.4 6v3H3.6v-3c0-3.6 3.8-6 8.4-6Z"
          />
        </symbol>
        <symbol id="i-pin" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 22.6S20.2 15 20.2 9.6A8.2 8.2 0 1 0 3.8 9.6C3.8 15 12 22.6 12 22.6Zm0-9.7a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
          />
        </symbol>
        <symbol id="i-question" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm0 3.6a4 4 0 0 1 2.2 7.3c-.6.4-.9.8-.9 1.4v.7h-2.5v-1c0-1.4.7-2.3 1.9-3 .6-.4.9-.8.9-1.4a1.6 1.6 0 0 0-3.2 0H8a4 4 0 0 1 4-4Zm-1.4 11.4h2.6v2.4h-2.6v-2.4Z"
          />
        </symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2.2a9.8 9.8 0 1 1-9.8 9.8h2.6a7.2 7.2 0 1 0 7.2-7.2c-2 0-3.9.9-5.1 2.3h3.5v2.5H3.6V3.1h2.5v2.2A9.7 9.7 0 0 1 12 2.2Z"
          />
        </symbol>
        <symbol id="i-restroom" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M7.4 1.8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2.6 5h5.2l1.7 7.4H9.9v8H5v-8H3.1L4.8 6.8ZM12 1.4h1.3v21.2H12V1.4ZM16.6 1.8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2.9 12.9 2.9-7.9h.9l2.9 7.9h-2.1v7.4h-2.4v-7.4h-2.2Z"
          />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M10.6 2.4a8.2 8.2 0 1 0 4.8 14.9l4.6 4.6 1.8-1.8-4.6-4.6A8.2 8.2 0 0 0 10.6 2.4Zm0 2.6a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2Z"
          />
        </symbol>
        <symbol id="i-sparkle" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8l2.1 5.7 5.7 2.1-5.7 2.1L12 17.4l-2.1-5.7L4.2 9.6l5.7-2.1L12 1.8Zm6.4 13.6 1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1 1-2.8Z"
          />
        </symbol>
        <symbol id="i-stairs" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M2.6 18.6h4.2v-4.4h4.4V9.8h4.4V5.4h5.8V2.6h-8v4.4h-4.4v4.4H4.6v4.4H2.6v2.8Zm0 2.2h18.8V23H2.6v-2.2Z"
          />
        </symbol>
        <symbol id="i-store" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M4.2 3.2h15.6l2.2 6.2h-1.5v12.4H3.5V9.4H2L4.2 3.2Zm5.2 12.2v6.4h5.2v-6.4H9.4Z"
          />
        </symbol>
        <symbol id="i-swap" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M8.2 1.8v16.4H5l4.4 4.4 4.4-4.4h-3.2V1.8H8.2Zm7.6 20.4V5.8H19L14.6 1.4 10.2 5.8h3.2v16.4h2.4Z"
          />
        </symbol>
        <symbol id="i-target" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm0 2.6a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2Zm0 3.4a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"
          />
        </symbol>
        <symbol id="i-train" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M5 2.6h14v13.8H5V2.6Zm2.2 2.2v4.2h3.6V4.8H7.2Zm6 0v4.2h3.6V4.8h-3.6Zm-4.6 6.8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm6.8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6ZM6.6 17.8h3l-2 3.6H4.2l2.4-3.6Zm10.8 0 2.4 3.6h-3.4l-2-3.6h3Z"
          />
        </symbol>
        <symbol id="i-warning" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2.2 22.6 21.4H1.4L12 2.2Zm-1.2 6.4v5.8h2.4V8.6h-2.4Zm0 7.6v2.4h2.4v-2.4h-2.4Z"
          />
        </symbol>
        {/* Counterpart to `i-check`, drawn with the same stroke weight. */}
        <symbol id="i-x" viewBox="0 0 24 24">
          <path
            d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        </symbol>
      </defs>
    </svg>
  );
}
