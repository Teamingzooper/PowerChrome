(function () {
  window.__powerMode = window.__powerMode || {};

  function setStyle(ctx, p) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
  }

  const shapes = {
    circle: function (ctx, p) {
      setStyle(ctx, p);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
    square: function (ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
    },
    triangle: function (ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size, p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    star: function (ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      const spikes = 5;
      const outer = p.size;
      const inner = p.size * 0.42;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    diamond: function (ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation + Math.PI / 4);
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
    }
  };

  window.__powerMode.shapes = shapes;
})();
