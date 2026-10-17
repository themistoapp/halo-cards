import { css } from "lit";

// The Entity card's looks, shared with the badges: plain, black on white, white on black and fifteen gradients.

export const GRADIENTS = ["dusk", "slate", "ember", "solar", "battery", "grid", "ocean", "glacier", "aurora", "forest", "rose", "plum", "sunset", "sand", "graphite"] as const;
export type Gradient = (typeof GRADIENTS)[number];
export const isGradientName = (v: unknown): v is Gradient => typeof v === "string" && (GRADIENTS as readonly string[]).includes(v);

/** Each gradient as --g on a .g-<name> element. */
export const gradientStyles = css`
  /* Full-coverage gradients. Grid, battery and solar use the colours those things have on the other cards. */
  .g-dusk { --g: radial-gradient(110% 80% at 0% 0%, #eab58e 0%, transparent 62%), radial-gradient(110% 90% at 100% 100%, #2b3fd8 0%, transparent 66%), linear-gradient(165deg, #d8a7a4 0%, #9e9ce8 48%, #3d52e2 100%); }
  .g-slate { --g: radial-gradient(120% 70% at 20% 0%, #b3bbd6 0%, transparent 70%), linear-gradient(175deg, #9aa5c6 0%, #6f7ea9 55%, #56669a 100%); }
  .g-ember { --g: radial-gradient(110% 80% at 0% 0%, #f09a4e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #7c44e4 0%, transparent 66%), linear-gradient(165deg, #ea8a56 0%, #dc4e7c 52%, #8f47dc 100%); }
  .g-solar { --g: radial-gradient(110% 80% at 0% 0%, #f6cf62 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #e0568a 0%, transparent 62%), linear-gradient(165deg, #f0bd52 0%, #e88a3e 55%, #dd5f78 100%); }
  .g-battery { --g: radial-gradient(110% 80% at 0% 0%, #7fd6a8 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1f7894 0%, transparent 64%), linear-gradient(165deg, #5cc596 0%, #2f9f86 55%, #22809a 100%); }
  .g-grid { --g: radial-gradient(110% 80% at 0% 0%, #b9aefc 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #2f6bff 0%, transparent 64%), linear-gradient(165deg, #9a8cf7 0%, #6f5cff 52%, #3c6cf5 100%); }
  .g-ocean { --g: radial-gradient(110% 80% at 0% 0%, #7cc8ef 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1b46a0 0%, transparent 64%), linear-gradient(165deg, #5fb3e6 0%, #2f7fd0 52%, #1f52aa 100%); }
  .g-glacier { --g: radial-gradient(110% 80% at 0% 0%, #d2e8f4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4c74ad 0%, transparent 64%), linear-gradient(165deg, #a9cbe4 0%, #7fa6cf 50%, #5a80b6 100%); }
  .g-aurora { --g: radial-gradient(110% 80% at 0% 0%, #66e3c2 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #7a52e6 0%, transparent 64%), linear-gradient(165deg, #4fd1b6 0%, #44a2e0 50%, #6f5ae4 100%); }
  .g-forest { --g: radial-gradient(110% 80% at 0% 0%, #9ccd7e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #255f53 0%, transparent 64%), linear-gradient(165deg, #82bd6e 0%, #4b9660 52%, #2c6d5a 100%); }
  .g-rose { --g: radial-gradient(110% 80% at 0% 0%, #f8b3c0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #a8356f 0%, transparent 64%), linear-gradient(165deg, #f0a0b2 0%, #e2668c 52%, #b5407a 100%); }
  .g-plum { --g: radial-gradient(110% 80% at 0% 0%, #c39be0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4b2580 0%, transparent 64%), linear-gradient(165deg, #b085d6 0%, #8650b8 52%, #5c308c 100%); }
  .g-sunset { --g: radial-gradient(110% 80% at 0% 0%, #ffc06f 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #c2405e 0%, transparent 64%), linear-gradient(165deg, #ffab62 0%, #f26d5e 52%, #c94466 100%); }
  .g-sand { --g: radial-gradient(110% 80% at 0% 0%, #efd3a4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #946640 0%, transparent 64%), linear-gradient(165deg, #dfbe8c 0%, #c49763 52%, #a0734a 100%); }
  .g-graphite { --g: radial-gradient(110% 80% at 0% 0%, #7d828e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1d1f24 0%, transparent 64%), linear-gradient(165deg, #6a6e79 0%, #44474f 52%, #2a2c32 100%); }
`;
