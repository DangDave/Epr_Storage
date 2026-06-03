import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export default function FloorPlan({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [labelLine, setLabelLine] = useState(null); // { index, label }
  const [units, setUnits] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [drawnLines, setDrawnLines] = useState([]);
  const [modified, setModified] = useState(new Set());
  const svgRef = useRef(null);

  useEffect(() => {
    axios.get('/api/floor-plan', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { setData(res.data); setUnits(res.data.units.map(u => ({...u}))); if (res.data.walkways) setDrawnLines(res.data.walkways); })
      .catch(console.error).finally(() => setLoading(false));
  }, [token]);

  // ---- Drag handlers (edit mode) ----
  const handleMouseDown = useCallback((e, unit) => {
    if (!editMode) return;
    if (drawMode) return; // let draw mode handle it
    e.stopPropagation();
    const svg = svgRef.current, rect = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    setDragging({ id: unit.id, sx: e.clientX, sy: e.clientY, ox: unit.pos_x, oy: unit.pos_y, scaleX: vb.width/rect.width, scaleY: vb.height/rect.height });
  }, [editMode]);

  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragging.sx) * dragging.scaleX, dy = (e.clientY - dragging.sy) * dragging.scaleY;
      setUnits(prev => prev.map(u => u.id === dragging.id ? { ...u, pos_x: Math.round((dragging.ox+dx)*10)/10, pos_y: Math.round((dragging.oy+dy)*10)/10 } : u));
      setModified(prev => new Set([...prev, dragging.id]));
    }
    if (drawing) {
      const svg = svgRef.current, rect = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const x = vb.x + (e.clientX - rect.left) * vb.width / rect.width;
      const y = vb.y + (e.clientY - rect.top) * vb.height / rect.height;
      setDrawing(prev => ({ ...prev, x2: x, y2: y }));
    }
  }, [dragging, drawing]);

  const handleMouseUp = useCallback(() => {
    if (drawing && (Math.abs(drawing.x2-drawing.x1) > 3 || Math.abs(drawing.y2-drawing.y1) > 3)) {
      setDrawnLines(prev => [...prev, drawing]);
    }
    setDrawing(null);
    setDragging(null);
  }, [drawing]);

  // ---- Draw mode ----
  const handleCanvasDown = useCallback((e) => {
    if (!drawMode) return;
    // Allow drawing anywhere on the SVG
    const svg = svgRef.current, rect = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const x = vb.x + (e.clientX - rect.left) * vb.width / rect.width;
    const y = vb.y + (e.clientY - rect.top) * vb.height / rect.height;
    setDrawing({ x1: x, y1: y, x2: x, y2: y });
  }, [drawMode]);

  // ---- Save ----
  const save = async () => {
    const h = { Authorization: `Bearer ${token}` };
    // Save unit positions
    const ups = units.filter(u => modified.has(u.id)).map(u => ({ id: u.id, position_x: u.pos_x, position_y: u.pos_y, width: u.width, height: u.height }));
    if (ups.length) await axios.post('/api/units/batch-positions', { updates: ups }, { headers: h });
    // Save walkways
    if (drawnLines.length) await axios.put('/api/floor-plan', { walkways: drawnLines }, { headers: h });
    setModified(new Set()); alert('Saved');
  };

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading...</div>;

  const displayUnits = units.length ? units : data.units;
  const pad = 30;
  const minX = Math.min(...displayUnits.map(u => u.pos_x)) - pad;
  const minY = Math.min(...displayUnits.map(u => u.pos_y)) - pad;
  const maxX = Math.max(...displayUnits.map(u => u.pos_x + u.width)) + pad;
  const maxY = Math.max(...displayUnits.map(u => u.pos_y + u.height)) + pad;
  const vb = `${minX} ${minY} ${maxX-minX} ${maxY-minY}`;

  const zones = {};
  displayUnits.forEach(u => { const z = u.zone || 'Other'; if (!zones[z]) zones[z] = []; zones[z].push(u); });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1e293b', margin:0 }}>Floor Plan</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {editMode && modified.size > 0 && <span style={{ fontSize:13, color:'#ea580c' }}>{modified.size} moved</span>}
          {drawMode && <span style={{ fontSize:13, color:'#3b82f6' }}>Click & drag to draw lines — {drawnLines.length} drawn</span>}
          <button onClick={() => { setEditMode(!editMode); setDrawMode(false); setDragging(null); }}
            style={{ padding:'6px 14px', fontSize:13, fontWeight:600, color:'#fff', background:editMode?'#dc2626':'#eab308', border:'none', borderRadius:6, cursor:'pointer' }}>
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => { setDrawMode(!drawMode); setEditMode(false); setDrawing(null); }}
            style={{ padding:'6px 14px', fontSize:13, fontWeight:600, color:'#fff', background:drawMode?'#dc2626':'#3b82f6', border:'none', borderRadius:6, cursor:'pointer' }}>
            {drawMode ? 'Stop' : 'Draw Lines'}
          </button>
          {(editMode || drawMode) && <button onClick={save}
            style={{ padding:'6px 14px', fontSize:13, fontWeight:600, color:'#fff', background:'#16a34a', border:'none', borderRadius:6, cursor:'pointer' }}>Save</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:8, fontSize:11 }}>
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:12,height:12,borderRadius:2,background:'#fef9c3',border:'1.5px solid #1e293b',display:'inline-block'}} /> Available</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:12,height:12,borderRadius:2,background:'#fee2e2',border:'1.5px solid #1e293b',display:'inline-block'}} /> Occupied</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:12,height:12,borderRadius:2,background:'#bfdbfe',border:'1.5px solid #1e293b',display:'inline-block'}} /> Reserved</span>
        {drawMode && <span style={{color:'#3b82f6'}}>— Drawing mode active</span>}
      </div>

      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden' }}>
        <svg ref={svgRef} viewBox={vb} style={{ width:'100%', maxWidth:1100, display:'block' }}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onMouseDown={handleCanvasDown}>

          <rect x={minX} y={minY} width={maxX-minX} height={maxY-minY} fill="#fdfdfd" className="canvas-bg" />
          <defs>
            <pattern id="g" width={20} height={20} patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8e8e8" strokeWidth={0.3} />
            </pattern>
          </defs>
          <rect x={minX} y={minY} width={maxX-minX} height={maxY-minY} fill="url(#g)" className="canvas-bg" />

          {/* Drawn walkway lines */}
          {drawnLines.map((l, i) => (
            <g key={'dl-'+i} onDoubleClick={() => setLabelLine({ index: i, label: l.label || '' })}
              style={{ cursor: 'pointer' }}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,3" />
              <title>Double-click to name this walkway</title>
            </g>
          ))}

          {/* Currently drawing line */}
          {drawing && (
            <line x1={drawing.x1} y1={drawing.y1} x2={drawing.x2} y2={drawing.y2} stroke="#3b82f6" strokeWidth={2} strokeDasharray="8,4" />
          )}

          {/* Zone labels */}
          {Object.entries(zones).map(([name, grp]) => {
            const zMinY = Math.min(...grp.map(u => u.pos_y)), zMaxY = Math.max(...grp.map(u => u.pos_y + u.height));
            return <text key={'zl-'+name} x={minX+4} y={(zMinY+zMaxY)/2} fill="#94a3b8" fontSize={7}
              transform={`rotate(-90,${minX+4},${(zMinY+zMaxY)/2})`} textAnchor="middle">{name}</text>;
          })}

          {/* Perimeter walls - 4 separate lines so we can leave door gaps */}
          {(() => {
            const wx=minX+15, wy=minY+15, ww=maxX-minX-30, wh=maxY-minY-30;
            // Door gap on east wall - between SE Top and SE Bottom
            const seT = displayUnits.filter(u => u.zone === 'SE Top');
            const seB = displayUnits.filter(u => u.zone === 'SE Bottom');
            let doorTop = null, doorBot = null;
            if (seT.length && seB.length) {
              const gapMid = (Math.max(...seT.map(u => u.pos_y + u.height)) + Math.min(...seB.map(u => u.pos_y))) / 2;
              doorTop = gapMid - 25;
              doorBot = gapMid + 25;
            }
            return <g>
              {/* North wall - with 50px door gap between NW Row 1 and Containers */}
              {(() => {
                const r1 = displayUnits.filter(u => u.zone === 'NW Row 1');
                const cont = displayUnits.filter(u => u.zone === 'Containers');
                if (r1.length && cont.length) {
                  const gapMid = (Math.max(...r1.map(u => u.pos_x + u.width)) + Math.min(...cont.map(u => u.pos_x))) / 2;
                  return <>
                    <line x1={wx} y1={wy} x2={gapMid-25} y2={wy} stroke="#1e293b" strokeWidth={1.5} />
                    <line x1={gapMid+25} y1={wy} x2={wx+ww} y2={wy} stroke="#1e293b" strokeWidth={1.5} />
                  </>;
                }
                return <line x1={wx} y1={wy} x2={wx+ww} y2={wy} stroke="#1e293b" strokeWidth={1.5} />;
              })()}
              {/* South wall - full */}
              <line x1={wx} y1={wy+wh} x2={wx+ww} y2={wy+wh} stroke="#1e293b" strokeWidth={1.5} />
              {/* West wall - full */}
              <line x1={wx} y1={wy} x2={wx} y2={wy+wh} stroke="#1e293b" strokeWidth={1.5} />
              {/* East wall - with door gap */}
              {doorTop ? (
                <>
                  <line x1={wx+ww} y1={wy} x2={wx+ww} y2={doorTop} stroke="#1e293b" strokeWidth={1.5} />
                  <line x1={wx+ww} y1={doorBot} x2={wx+ww} y2={wy+wh} stroke="#1e293b" strokeWidth={1.5} />
                </>
              ) : (
                <line x1={wx+ww} y1={wy} x2={wx+ww} y2={wy+wh} stroke="#1e293b" strokeWidth={1.5} />
              )}
              <text x={wx+ww/2} y={wy-6} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight={700}>NORTH</text>
              <text x={wx+ww/2} y={wy+wh+14} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight={700}>SOUTH</text>
              <text x={wx-6} y={wy+wh/2} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight={700} transform={`rotate(-90,${wx-6},${wy+wh/2})`}>WEST</text>
              <text x={wx+ww+6} y={wy+wh/2} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight={700} transform={`rotate(90,${wx+ww+6},${wy+wh/2})`}>EAST</text>
            </g>;
          })()}

          {/* Units */}
          {displayUnits.map(u => {
            const isFull = u.status === 'occupied', isRes = u.status === 'reserved';
            const fill = isFull ? '#fca5a5' : isRes ? '#bfdbfe' : '#fef9c3';
            const isDragging = dragging?.id === u.id, isHovered = hovered === u.id;
            const doorSide = getDoorSide(u);
            return (
              <g key={u.id} onClick={() => !editMode&&!drawMode&&setSelected(u.id===selected?null:u.id)}
                onMouseDown={e => handleMouseDown(e, u)}
                onMouseEnter={() => !editMode&&!drawMode&&setHovered(u.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: editMode?'move':drawMode?'crosshair':'pointer', pointerEvents: 'all' }}>
                <rect x={u.pos_x} y={u.pos_y} width={u.width} height={u.height} rx={1} fill={fill} stroke="#1e293b" strokeWidth={isDragging?3:2} />
                {doorSide && (() => { const d = doorGap(u, doorSide);
                  return <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={fill==='#fef9c3'?'#fdfdfd':fill==='#fca5a5'?'#fca5a5':fill} strokeWidth={3} />; })()}
                <text x={u.pos_x+u.width/2} y={u.pos_y+u.height/2} textAnchor="middle" dominantBaseline="middle"
                  fill={isFull?'#7f1d1d':isRes?'#1e40af':'#1e293b'} fontSize={u.width<45?7.5:9} fontWeight={700}
                  style={{ pointerEvents:'none', userSelect:'none' }}>{u.unit_number}</text>
                {u.job_name && <text x={u.pos_x+u.width/2} y={u.pos_y+u.height/2-10} textAnchor="middle" dominantBaseline="middle"
                  fill="#64748b" fontSize={6} style={{ pointerEvents:'none', userSelect:'none' }}>{u.job_name.substring(0,8)}</text>}
                <rect x={u.pos_x} y={u.pos_y} width={u.width} height={u.height} fill="transparent" />
                <title>{u.unit_number} — {u.size_name} — {u.status}{u.job_name?'\nJob: '+u.job_name:''}</title>
              </g>
            );
          })}

          {/* Hover highlights - drawn AFTER all boxes so they show on top */}
          {!editMode && !drawMode && hovered && (() => {
            const u = displayUnits.find(x => x.id === hovered);
            if (!u) return null;
            return <rect x={u.pos_x-4} y={u.pos_y-4} width={u.width+8} height={u.height+8}
              rx={4} fill="none" stroke="#eab308" strokeWidth={4} opacity={1} />;
          })()}
        </svg>

        {selected && !editMode && !drawMode && (() => {
          const u = displayUnits.find(x => x.id === selected);
          if (!u) return null;
          const isFull = u.status === 'occupied';
          return (
            <div style={{ padding:20, borderTop:'1px solid #e2e8f0', background:'#fafafa' }}>
              <div style={{ display:'flex', gap:32, alignItems:'center', marginBottom:u.job_name?16:0 }}>
                <div><strong style={{ fontSize:18 }}>{u.unit_number}</strong></div>
                <div style={{ fontSize:14, color:'#475569' }}>{u.size_name} · {u.dimensions||''} · {u.volume||''}</div>
                {u.street && <div style={{ fontSize:13, color:'#64748b', fontWeight:600 }}>📍 {u.street}</div>}
                <div style={{ fontSize:13, color:'#94a3b8' }}>Zone: {u.zone||'—'}</div>
                <div style={{ padding:'4px 12px', borderRadius:12, fontSize:12, fontWeight:700,
                  background:isFull?'#fef2f2':u.status==='reserved'?'#dbeafe':'#fef9c3',
                  color:isFull?'#dc2626':u.status==='reserved'?'#1e40af':'#a16207' }}>{u.status.toUpperCase()}</div>
              </div>
              {u.job_name && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, background:'#fff', padding:16, borderRadius:8, border:'1px solid #e2e8f0' }}>
                  <div><div style={{fontSize:11,color:'#94a3b8'}}>Job Name</div><div style={{fontWeight:600}}>{u.job_name}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8'}}>Contact</div><div>{u.job_contact||'—'}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8'}}>Phone</div><div>{u.job_phone||'—'}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8'}}>Start Date</div><div>{u.start_date||'—'}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8'}}>Notes</div><div>{u.job_notes||'—'}</div></div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Walkway label modal */}
      {labelLine !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setLabelLine(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 12, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Name Walkway</h3>
            <input autoFocus value={labelLine.label}
              onChange={e => setLabelLine({ ...labelLine, label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') {
                const u = [...drawnLines]; u[labelLine.index] = { ...u[labelLine.index], label: labelLine.label };
                setDrawnLines(u); setLabelLine(null);
              }}}
              placeholder="e.g. Main Corridor, Walkway A..."
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const u = [...drawnLines]; u[labelLine.index] = { ...u[labelLine.index], label: labelLine.label };
                setDrawnLines(u); setLabelLine(null);
              }} style={{ flex: 1, padding: 10, background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setLabelLine(null)} style={{ padding: 10, background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDoorSide(unit) {
  const z = unit.zone || '';
  if (unit.unit_number === 'L-41') return 'west';
  if (z === 'NW Row 1') return 'south';
  if (z === 'NW Row 2') return 'north';
  if (z === 'NW Row 3') return 'south';
  if (z === 'NW Left') return 'east';
  if (z === 'Containers') return 'west';
  if (z === 'SW Col 1') return 'east';
  if (z === 'SW Col 2' || z === 'SW Col 4' || z === 'SW Col 6') return 'west';
  if (z === 'SW Col 3' || z === 'SW Col 5') return 'east';
  if (z === 'SE Top') return 'south';
  if (z === 'SE Bottom') return 'north';
  return null;
}

function doorGap(u, side) {
  const x=u.pos_x, y=u.pos_y, w=u.width, h=u.height, g=10;
  switch(side){ case'south':return{x1:x+w/2-g/2,y1:y+h,x2:x+w/2+g/2,y2:y+h}; case'north':return{x1:x+w/2-g/2,y1:y,x2:x+w/2+g/2,y2:y}; case'east':return{x1:x+w,y1:y+h/2-g/2,x2:x+w,y2:y+h/2+g/2}; case'west':return{x1:x,y1:y+h/2-g/2,x2:x,y2:y+h/2+g/2}; default:return{x1:0,y1:0,x2:0,y2:0}; }
}
