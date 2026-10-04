// ORBIT — audio sets the orbital speed of a swarm circling the object.
export default {
  id: 'orbit',
  update(c) {
    const { P, S, acc, s, t, hit, hitS, dt } = c;
    S.kick = (S.kick || 0) * Math.pow(0.5, dt / 0.5);
    if (hit) { S.kick = Math.min(3, S.kick + 1.4 * hitS); c.spr.scale.kick(2 * hitS); }
    P.scaleT = 1 + 0.12 * acc.scale;
    P.rotT[1] += 0.5 * Math.sin(t * 0.35) + acc.rotation * 0.5 * Math.sin(t * 0.9);
    P.rotT[0] += 0.12 * Math.sin(t * 0.5);
    P.pMode = 0;
    P.pOrbitMix = 0.78;
    P.pOrbit = 0.9 + 3.6 * acc.particles + 2.2 * s.energy + S.kick;
    P.pOrbitR = 0.6 + 0.16 * S.kick + 0.1 * s.bass;
    P.pSpring = 22; P.pDamp = 2.4;
    P.pDensity = Math.min(1, 0.55 + 0.45 * acc.particles);
    P.pSize = 2.1;
    P.pFlow = 0.25;
    P.flash = 0.15 * S.kick;
  },
};
