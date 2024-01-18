// Copyright 2023, University of Colorado Boulder

// @author Jonathan Olson <jonathan.olson@colorado.edu>

let alpenglow;
let ArrowNode;
let scenery;
let kite;
let dot;

// If we loaded phet-lib, use that copy
if ( window.usePhetLib ) {
  alpenglow = window.phet.alpenglow;
  ArrowNode = window.phet.sceneryPhet.ArrowNode;
  scenery = window.phet.scenery;
  kite = window.phet.kite;
  dot = window.phet.dot;
}
// Otherwise, load from our transpilation (assuming for development mode)
else {
  alpenglow = ( await import( '../../chipper/dist/js/alpenglow/js/main.js' ) ).default; // eslint-disable-line bad-sim-text
  ArrowNode = ( await import( '../../chipper/dist/js/scenery-phet/js/ArrowNode.js' ) ).default; // eslint-disable-line bad-sim-text
  scenery = ( await import( '../../chipper/dist/js/scenery/js/main.js' ) ).default; // eslint-disable-line bad-sim-text
  kite = ( await import( '../../chipper/dist/js/kite/js/main.js' ) ).default; // eslint-disable-line bad-sim-text
  dot = ( await import( '../../chipper/dist/js/dot/js/main.js' ) ).default; // eslint-disable-line bad-sim-text
}

const Node = scenery.Node;
const Display = scenery.Display;
const Color = scenery.Color;
const Rectangle = scenery.Rectangle;
const Path = scenery.Path;
const LinearGradient = scenery.LinearGradient;
const RadialGradient = scenery.RadialGradient;
const Text = scenery.Text;
const Image = scenery.Image;
const Circle = scenery.Circle;

const Shape = kite.Shape;
const LineStyles = kite.LineStyles;

const RenderLinearGradientAccuracy = alpenglow.RenderLinearGradientAccuracy;
const RenderRadialBlend = alpenglow.RenderRadialBlend;
const RenderRadialBlendAccuracy = alpenglow.RenderRadialBlendAccuracy;
const RenderBlendType = alpenglow.RenderBlendType;
const RenderRadialGradientAccuracy = alpenglow.RenderRadialGradientAccuracy;
const RenderRadialGradient = alpenglow.RenderRadialGradient;
const RenderImage = alpenglow.RenderImage;
const RenderGradientStop = alpenglow.RenderGradientStop;
const RenderExtend = alpenglow.RenderExtend;
const RenderDepthSort = alpenglow.RenderDepthSort;
const RenderPlanar = alpenglow.RenderPlanar;
const Mesh = alpenglow.Mesh;
const RenderStack = alpenglow.RenderStack;
const RenderLinearGradient = alpenglow.RenderLinearGradient;
const RenderPathBoolean = alpenglow.RenderPathBoolean;
const RenderPath = alpenglow.RenderPath;
const RenderFromNode = alpenglow.RenderFromNode;
const RenderComposeType = alpenglow.RenderComposeType;
const RenderBlendCompose = alpenglow.RenderBlendCompose;
const PolygonFilterType = alpenglow.PolygonFilterType;
const RenderLinearSRGBToSRGB = alpenglow.RenderLinearSRGBToSRGB;
const RenderNormalDebug = alpenglow.RenderNormalDebug;
const RenderPhong = alpenglow.RenderPhong;
const RenderLight = alpenglow.RenderLight;
const RenderBarycentricPerspectiveBlend = alpenglow.RenderBarycentricPerspectiveBlend;
const RenderBarycentricPerspectiveBlendAccuracy = alpenglow.RenderBarycentricPerspectiveBlendAccuracy;
const RenderNormalize = alpenglow.RenderNormalize;
const RenderColor = alpenglow.RenderColor;
const CombinedRaster = alpenglow.CombinedRaster;
const Rasterize = alpenglow.Rasterize;
const LinearEdge = alpenglow.LinearEdge;
const PolygonalBoolean = alpenglow.PolygonalBoolean;
const RenderColorSpace = alpenglow.RenderColorSpace;
const TestToCanvas = alpenglow.TestToCanvas;
const RenderLinearBlend = alpenglow.RenderLinearBlend;
const RenderLinearBlendAccuracy = alpenglow.RenderLinearBlendAccuracy;
const RenderResampleType = alpenglow.RenderResampleType;
const RenderBarycentricBlend = alpenglow.RenderBarycentricBlend;
const RenderBarycentricBlendAccuracy = alpenglow.RenderBarycentricBlendAccuracy;

const Bounds2 = dot.Bounds2;
const Matrix3 = dot.Matrix3;
const Matrix4 = dot.Matrix4;
const Vector2 = dot.Vector2;
const Vector4 = dot.Vector4;
const v2 = dot.v2;
const v3 = dot.v3;
const v4 = dot.v4;

window.deviceContextPromise = phet.alpenglow.DeviceContext.getDevice().then( device => {
  if ( device ) {
    return new phet.alpenglow.DeviceContext( device );
  }
  else {
    return null;
  }
} );

window.piecewiseOptions = {
  minLevels: 1,
  maxLevels: 10,
  // distanceEpsilon: 0.02,
  distanceEpsilon: 0.0002,
  curveEpsilon: 0.2
};
window.shapeToPolygons = shape => shape.subpaths.map( subpath => {
  return subpath.toPiecewiseLinear( window.piecewiseOptions ).segments.map( line => {
    return line.start;
  } );
} );

window.diagramFont = new phet.scenery.Font( {
  size: 12,
  family: 'Arial, sans-serif'
} );

const piecewiseOptions = {
  minLevels: 1,
  maxLevels: 10,
  // distanceEpsilon: 0.02,
  distanceEpsilon: 0.0002,
  curveEpsilon: 0.2
};
const shapeToPolygons = shape => shape.subpaths.map( subpath => {
  return subpath.toPiecewiseLinear( piecewiseOptions ).segments.map( line => {
    return line.start;
  } );
} );

window.sizeCanvas = canvas => {
  canvas.style.width = `${canvas.width / window.devicePixelRatio}px`;
  canvas.style.height = `${canvas.height / window.devicePixelRatio}px`;
};

window.getSceneryElement = ( node, width, height, background, renderer ) => {
  const subdiv = document.createElement( 'div' );
  subdiv.style.margin = '0 auto';
  const scene = new Node( { renderer: renderer } );
  const display = new Display( scene, {
    width: width,
    height: height,
    accessibility: true,
    container: subdiv,
    allowCSSHacks: false
  } );

  display.width = width;
  display.height = height;
  scene.addChild( node );
  display.backgroundColor = background;
  display.updateDisplay();
  scene.removeChild( node );
  return subdiv;
};

// composite Rasterize/CombinedRaster options
window.getRasterizedElement = ( renderProgram, width, height, options ) => {
  const program = renderProgram.transformed( Matrix3.scaling( window.devicePixelRatio ) );

  const outputWidth = width * window.devicePixelRatio;
  const outputHeight = height * window.devicePixelRatio;

  const raster = new CombinedRaster( outputWidth, outputHeight, options );
  Rasterize.rasterize( program, raster, new Bounds2( 0, 0, outputWidth, outputHeight ), options );
  const canvas = Rasterize.imageDataToCanvas( raster.toImageData() );
  window.sizeCanvas( canvas );
  canvas.style.display = 'block';
  canvas.style.position = 'relative';
  canvas.style.margin = '0 auto';
  canvas.style.left = '0';
  canvas.style.top = '0';
  return canvas;
};

window.createRenderProgramSandbox = ( id, func, width, height, providedOptions ) => {

  if ( !showDiagrams ) {
    return;
  }

  const { js, jsBefore, jsAfter } = window.extractFunctionJS( func );

  const options = phet.phetCore.merge( {
    jsBefore: jsBefore,
    jsAfter: jsAfter,
    showInstructions: false
  }, providedOptions );

  const parentElement = document.getElementById( id );

  // remove all children
  while ( parentElement.firstChild ) {
    parentElement.removeChild( parentElement.firstChild );
  }

  const displayContainerElement = document.createElement( 'div' );
  !options.showInstructions && parentElement.appendChild( displayContainerElement );

  const codeContainerElement = document.createElement( 'div' );
  parentElement.appendChild( codeContainerElement );
  options.showInstructions && parentElement.appendChild( displayContainerElement );

  const errorsContainerElement = document.createElement( 'div' );
  parentElement.appendChild( errorsContainerElement );
  errorsContainerElement.classList.add( 'errors' );

  const codeMirror = CodeMirror( codeContainerElement, { // eslint-disable-line no-undef
    lineNumbers: true,
    tabSize: 2,
    value: js,
    mode: 'javascript',
    theme: 'monokai',
    lineWrapping: true
  } );

  const isDescendant = function( parent, child ) {
    let node = child;
    while ( node ) {
      if ( node === parent ) {
        return true;
      }

      // Traverse up to the parent
      node = node.parentNode;
    }

    // Go up until the root but couldn't find the `parent`
    return false;
  };

  window.addEventListener( 'keydown', event => {
    // if shift-enter is pressed
    if ( event.keyCode === 13 && event.shiftKey && isDescendant( document.getElementById( 'code' ), document.activeElement ) ) {
      run();

      event.preventDefault();
    }
  } );

  const run = async () => {


    displayContainerElement.style.backgroundColor = 'transparent';
    errorsContainerElement.style.display = 'none';

    try {
      // eslint-disable-next-line bad-sim-text
      const code = `${Math.random()};
      let value = (${options.jsBefore}
        const dot = phet.dot;
        const alpenglow = phet.alpenglow;
        const v2 = dot.v2;
        const v3 = dot.v3;
        const v4 = dot.v4;
        const Bounds2 = dot.Bounds2;
        const Matrix3 = dot.Matrix3;
        const Vector2 = dot.Vector2;
        const Vector3 = dot.Vector3;
        const Vector4 = dot.Vector4;
        const RenderBlendType = alpenglow.RenderBlendType;
        const RenderComposeType = alpenglow.RenderComposeType;
        const RenderExtend = alpenglow.RenderExtend;
        const RenderProgram = alpenglow.RenderProgram;
        const RenderPath = alpenglow.RenderPath;
        const RenderPathBoolean = alpenglow.RenderPathBoolean;
        const RenderColor = alpenglow.RenderColor;
        const RenderColorSpace = alpenglow.RenderColorSpace;
        const RenderColorSpaceConversion = alpenglow.RenderColorSpaceConversion;
        const RenderAlpha = alpenglow.RenderAlpha;
        const RenderNormalize = alpenglow.RenderNormalize;
        const RenderPremultiply = alpenglow.RenderPremultiply;
        const RenderUnpremultiply = alpenglow.RenderUnpremultiply;
        const RenderSRGBToLinearSRGB = alpenglow.RenderSRGBToLinearSRGB;
        const RenderLinearSRGBToSRGB = alpenglow.RenderLinearSRGBToSRGB;
        const RenderOklabToLinearSRGB = alpenglow.RenderOklabToLinearSRGB;
        const RenderLinearSRGBToOklab = alpenglow.RenderLinearSRGBToOklab;
        const RenderLinearDisplayP3ToLinearSRGB = alpenglow.RenderLinearDisplayP3ToLinearSRGB;
        const RenderLinearSRGBToLinearDisplayP3 = alpenglow.RenderLinearSRGBToLinearDisplayP3;
        const RenderBlendCompose = alpenglow.RenderBlendCompose;
        const RenderStack = alpenglow.RenderStack;
        const RenderPlanar = alpenglow.RenderPlanar;
        const RenderDepthSort = alpenglow.RenderDepthSort;
        const RenderLight = alpenglow.RenderLight;
        const RenderNormalDebug = alpenglow.RenderNormalDebug;
        const RenderPhong = alpenglow.RenderPhong;
        const RenderFilter = alpenglow.RenderFilter;
        const RenderGradientStop = alpenglow.RenderGradientStop;
        const RenderImage = alpenglow.RenderImage;
        const RenderLinearBlend = alpenglow.RenderLinearBlend;
        const RenderLinearBlendAccuracy = alpenglow.RenderLinearBlendAccuracy;
        const RenderBarycentricBlend = alpenglow.RenderBarycentricBlend;
        const RenderBarycentricBlendAccuracy = alpenglow.RenderBarycentricBlendAccuracy;
        const RenderBarycentricPerspectiveBlend = alpenglow.RenderBarycentricPerspectiveBlend;
        const RenderBarycentricPerspectiveBlendAccuracy = alpenglow.RenderBarycentricPerspectiveBlendAccuracy;
        const RenderLinearGradient = alpenglow.RenderLinearGradient;
        const RenderLinearGradientAccuracy = alpenglow.RenderLinearGradientAccuracy;
        const RenderRadialBlend = alpenglow.RenderRadialBlend;
        const RenderRadialBlendAccuracy = alpenglow.RenderRadialBlendAccuracy;
        const RenderRadialGradient = alpenglow.RenderRadialGradient;
        const RenderRadialGradientAccuracy = alpenglow.RenderRadialGradientAccuracy;
        const RenderResampleType = alpenglow.RenderResampleType;

        ${codeMirror.getValue()}
        ${options.jsAfter}
      )();
      export default value;`;

      // Assumes it's in a function, differently from the sandbox
      const dataURI = `data:text/javascript;base64,${btoa( code )}`;

      const program = ( await import( dataURI ) ).default;

      let element;
      if ( options.showInstructions ) {
        const container = document.createElement( 'div' );
        element = container;

        const createPre = contents => {
          const pre = document.createElement( 'pre' );
          pre.style.textAlign = 'left';
          pre.style.marginTop = '10px';
          pre.style.fontSize = '10px';
          pre.style.lineHeight = '12px';
          pre.textContent = contents;
          return pre;
        };

        const createHeader = name => {
          const h6 = document.createElement( 'h6' );
          h6.style.textAlign = 'left';
          h6.textContent = name;
          return h6;
        };

        container.appendChild( createHeader( 'RenderProgram' ) );
        container.appendChild( createPre( program.toRecursiveString() ) );

        if ( !program.simplified().equals( program ) ) {
          container.appendChild( createHeader( 'RenderProgram Simplified' ) );
          container.appendChild( createPre( program.simplified().toRecursiveString() ) );
        }

        const instructions = [];
        program.writeInstructions( instructions );

        container.appendChild( createHeader( 'Instructions' ) );
        container.appendChild( createPre( instructions.map( instruction => instruction.toString() ).join( '\n' ) ) );

        const encoder = new phet.alpenglow.ByteEncoder();
        phet.alpenglow.RenderInstruction.instructionsToBinary( encoder, instructions );

        let debugLines = encoder.getDebug32String().trim().split( '\n' );

        // Strip off the header line
        const outputDebugLines = [ debugLines[ 0 ] ];
        debugLines = debugLines.slice( 1 );

        let instructionAddress = 0;
        let dwords = 0;
        for ( let i = 0; i < debugLines.length; i++ ) {
          while ( i === dwords && instructionAddress < instructions.length ) {
            const instruction = instructions[ instructionAddress++ ];
            outputDebugLines.push( instruction.toString() );
            dwords += instruction.getBinaryLength();
          }
          if ( i === debugLines.length - 1 ) {
            outputDebugLines.push( 'RenderInstructionExit()' );
          }
          outputDebugLines.push( debugLines[ i ] );
        }

        container.appendChild( createHeader( 'Binary Instructions' ) );
        container.appendChild( createPre( outputDebugLines.join( '\n' ) ) );
      }
      else {
        element = window.getRasterizedElement( program, width, height, options );
      }

      // Clear content
      while ( displayContainerElement.firstChild ) {
        displayContainerElement.removeChild( displayContainerElement.lastChild );
      }
      displayContainerElement.appendChild( element );
      displayContainerElement.style.opacity = '100%';
    }
    catch( e ) {
      console.error( e );
      displayContainerElement.style.backgroundColor = 'rgba(255,0,0,0.2)';
      errorsContainerElement.style.display = 'block';
      errorsContainerElement.innerHTML = `<pre>${e}</pre>`;
      displayContainerElement.style.opacity = '50%';
    }
  };

  codeMirror.on( 'change', editor => run && run() );

  run();
};

const urlParams = new URLSearchParams( window.location.search );
const showDiagrams = urlParams.get( 'diagrams' ) !== 'hide';

setTimeout( () => {
  if ( !showDiagrams ) {
    return;
  }

  const addDiagram = async ( id, callback ) => {
    const container = document.getElementById( id );
    if ( container ) {
      let diagram = callback();

      if ( diagram instanceof Promise ) {
        diagram = await diagram;
      }

      // Remove all children (especially any placeholders)
      while ( container.firstChild ) {
        container.removeChild( container.firstChild );
      }

      container.appendChild( diagram );
    }
  };
  window.addDiagram = addDiagram;
  // eslint-disable-next-line bad-sim-text
  window.pendingDiagrams.forEach( diagram => setTimeout( () => addDiagram( diagram.id, diagram.callback ), 0 ) );
}, 0 );

window.createSceneryDiagram = ( scene, width, height, needsWhiteBackground = false ) => {
  const div = document.createElement( 'div' );
  div.style.margin = '0 auto';
  const display = new Display( scene, {
    width: width,
    height: height,
    accessibility: true,
    container: div,
    allowCSSHacks: false
  } );
  if ( needsWhiteBackground ) {
    display.backgroundColor = '#fff';
  }
  display.updateDisplay();
  return div;
};

{
  const getConflation = ( type, pointCount ) => {
    const width = 128;
    const height = 128;

    const center = v2( width / 2 + 0.15992094, height / 2 + 0.426296 );
    const radius = width * 0.45;

    const polygons = [];
    const colors = [];
    for ( let i = 0; i < pointCount; i++ ) {
      const polygon = [];
      const angle0 = i * 2 * Math.PI / pointCount;
      const angle1 = ( i + 1 ) * 2 * Math.PI / pointCount;

      const chroma = Vector2.createPolar( 0.1, angle0 );
      colors.push( RenderColor.gamutMapSRGB( RenderColor.convert( v4( 0.5, chroma.x, chroma.y, 1 ), RenderColorSpace.oklab, RenderColorSpace.sRGB ) ) );

      const p0 = v2( center.x + radius * Math.cos( angle0 ), center.y + radius * Math.sin( angle0 ) );
      const p1 = v2( center.x + radius * Math.cos( angle1 ), center.y + radius * Math.sin( angle1 ) );

      polygon.push( center );
      polygon.push( p0 );
      polygon.push( p1 );
      polygons.push( polygon );
    }

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        new Node( {
          children: [
            new Rectangle( 0, 64, 128, 64, { fill: 'black' } ),
            ...polygons.map( ( poly, i ) => {
              return new Path( Shape.polygon( poly ), { fill: new Color( colors[ i ].x * 255, colors[ i ].y * 255, colors[ i ].z * 255, 1 ) } );
            } )
          ]
        } ),
        width, height, 'white', type
      );
    }
    else if ( type === 'default' ) {
      const program = new RenderStack(
        [
          new RenderPathBoolean(
            new RenderPath( 'nonzero', [ [
              v2( 0, 64 ),
              v2( 128, 64 ),
              v2( 128, 128 ),
              v2( 0, 128 )
            ] ] ),
            RenderFromNode.colorFrom( 'black' ),
            RenderFromNode.colorFrom( 'white' )
          ),
          ...polygons.map( ( polygon, i ) => new RenderPathBoolean(
            new RenderPath( 'nonzero', [ polygon ] ),
            new RenderColor( colors[ i ] ),
            RenderColor.TRANSPARENT
          ) )
        ]
      );

      return window.getRasterizedElement( program, width, height );
    }
    else {
      throw new Error( 'unknown type' );
    }
  };

  window.addDiagram( 'conflation-canvas', () => getConflation( 'canvas', 100 ) );
  window.addDiagram( 'conflation-svg', () => getConflation( 'svg', 100 ) );
  window.addDiagram( 'conflation-default', () => getConflation( 'default', 100 ) );
}

{
  const getCheckerboard = type => {
    const width = 128;
    const height = width / 2;

    const dl = 10;

    const projectionMatrix = RenderDepthSort.getProjectionMatrix( 1, 100, -1, -1, 1, 1 );
    const rotationMatrix = Matrix3.rotationY( 0.1 ).timesMatrix( Matrix3.rotationX( 0 ) );
    const project = p => {

      // a rotation, for testing
      p = rotationMatrix.timesVector3( p.minus( v3( 0, 0, dl ) ) ).plus( v3( 0, 0, dl ) );

      const clip = projectionMatrix.timesVector4( v4( p.x, p.y, p.z, 1 ) );
      return v3( clip.x / clip.w, -clip.y / clip.w, clip.z / clip.w );
    };

    const polygons = [];

    const matrix = Matrix3.scaling( height ).timesMatrix( Matrix3.translation( 1, 0, 0 ) );

    const xSpan = 40;
    const y = -5;
    const zMax = 100;

    for ( let x = -xSpan; x < xSpan; x++ ) {
      for ( let z = 4; z < zMax; z++ ) {
        if ( ( x + z ) % 2 === 0 ) {
          continue;
        }
        const p0 = matrix.timesVector2( project( v3( x, y, z ) ).toVector2() );
        const p1 = matrix.timesVector2( project( v3( x + 1, y, z ) ).toVector2() );
        const p2 = matrix.timesVector2( project( v3( x + 1, y, z + 1 ) ).toVector2() );
        const p3 = matrix.timesVector2( project( v3( x, y, z + 1 ) ).toVector2() );

        polygons.push( [ p0, p1, p2, p3 ] );
      }
    }

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        new Node( {
          renderer: type,
          children: polygons.map( polygon => new Path( Shape.polygon( polygon ), { fill: 'black' } ) )
        } ),
        width, height, 'white', type
      );
    }
    else {
      const program = new RenderStack( [
        new RenderPathBoolean(
          new RenderPath( 'nonzero', polygons ),
          RenderFromNode.colorFrom( 'black' ),
          RenderFromNode.colorFrom( 'white' )
        )
      ] );

      return window.getRasterizedElement( program, width, height, {
        polygonFiltering: {
          box: PolygonFilterType.Box,
          bilinear: PolygonFilterType.Bilinear,
          mitchellNetravali: PolygonFilterType.MitchellNetravali
        }[ type ]
      } );
    }
  };

  window.addDiagram( 'checkerboard-canvas', () => getCheckerboard( 'canvas' ) );
  window.addDiagram( 'checkerboard-svg', () => getCheckerboard( 'svg' ) );
  window.addDiagram( 'checkerboard-box', () => getCheckerboard( 'box' ) );
  window.addDiagram( 'checkerboard-bilinear', () => getCheckerboard( 'bilinear' ) );
  window.addDiagram( 'checkerboard-mitchell-netravali', () => getCheckerboard( 'mitchellNetravali' ) );
}

{
  const getGradientAliasing = type => {
    const width = 128;
    const height = 128;

    const addColorStops = gradient => {
      gradient.addColorStop( 0, 'black' );

      for ( let i = 0.2; i < 0.3; i += 0.05 ) {
        gradient.addColorStop( i, 'white' );
        gradient.addColorStop( i + 0.0001, 'black' );
      }
      for ( let i = 0.3; i < 0.4; i += 0.025269 ) {
        gradient.addColorStop( i, 'white' );
        gradient.addColorStop( i + 0.0001, 'blue' );
      }
      for ( let i = 0.4; i < 0.5; i += 0.01 ) {
        gradient.addColorStop( i, 'white' );
        gradient.addColorStop( i + 0.0001, 'black' );
      }
      for ( let i = 0.5; i < 0.6; i += 0.005 ) {
        gradient.addColorStop( i, 'white' );
        gradient.addColorStop( i + 0.0001, 'red' );
      }
      gradient.addColorStop( 0.6, 'white' );
      gradient.addColorStop( 0.7, 'black' );
      gradient.addColorStop( 0.7001, 'white' );
      gradient.addColorStop( 0.8, 'black' );
      gradient.addColorStop( 0.8001, 'white' );
      gradient.addColorStop( 0.81, 'black' );
      gradient.addColorStop( 0.95, 'white' );
      gradient.addColorStop( 0.951, 'black' );
      gradient.addColorStop( 0.952, 'white' );
      gradient.addColorStop( 0.96, 'white' );
      gradient.addColorStop( 0.962, 'black' );
      gradient.addColorStop( 0.964, 'white' );
      gradient.addColorStop( 0.97, 'white' );
      gradient.addColorStop( 0.973, 'black' );
      gradient.addColorStop( 0.976, 'white' );
      gradient.addColorStop( 0.98, 'white' );
      gradient.addColorStop( 0.984, 'black' );
      gradient.addColorStop( 0.988, 'white' );
      gradient.addColorStop( 1, 'black' );
    };

    const linear = new LinearGradient( 10, 10, 118, 20 );
    addColorStops( linear );

    // Oops, tricky to get these to match up exactly.
    const delta = v2( 108, 10 );
    const center = phet.dot.Utils.lineLineIntersection( v2( 10, 10 ), v2( 10, 10 ).plus( delta.perpendicular ), v2( 0, 64 ), v2( 128, 64 ) );
    const radius = delta.magnitude;
    const rightPoint = phet.dot.Utils.lineLineIntersection( center, center.plus( delta ), v2( 128, 0 ), v2( 128, 128 ) );

    const radial = new RadialGradient( center.x, center.y, 0, center.x, center.y, radius );
    addColorStops( radial );

    const scene = new Node( {
      children: [
        new Path( Shape.polygon( [
          v2( 0, 0 ),
          v2( 128, 0 ),
          rightPoint,
          center,
          v2( 0, 64 )
        ] ), { fill: linear } ),
        new Path( Shape.polygon( [
          center,
          rightPoint,
          v2( 128, 128 ),
          v2( 0, 128 ),
          v2( 0, 64 )
        ] ), { fill: radial } )
      ]
    } );

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        scene, width, height, 'white', type
      );
    }
    else {
      const program = RenderFromNode.addBackgroundColor( RenderFromNode.nodeToRenderProgram( scene ), Color.WHITE );

      return window.getRasterizedElement( program, width, height, {
        polygonFiltering: {
          box: PolygonFilterType.Box,
          bilinear: PolygonFilterType.Bilinear,
          mitchellNetravali: PolygonFilterType.MitchellNetravali
        }[ type ]
      } );
    }
  };

  window.addDiagram( 'gradients-canvas', () => getGradientAliasing( 'canvas' ) );
  window.addDiagram( 'gradients-svg', () => getGradientAliasing( 'svg' ) );
  window.addDiagram( 'gradients-box', () => getGradientAliasing( 'box' ) );
  window.addDiagram( 'gradients-bilinear', () => getGradientAliasing( 'bilinear' ) );
  window.addDiagram( 'gradients-mitchell-netravali', () => getGradientAliasing( 'mitchellNetravali' ) );
}

{
  const getGradientPrecision = type => {
    const width = 128;
    const height = 128;

    // const left = -3000;
    // const right = 3000;

    const left = 0;
    const right = 6000;

    const ratioLeft = ( 0 - left ) / ( right - left );
    const ratioRight = ( width - left ) / ( right - left );

    const newRatio = ratio => ratioLeft + ratio * ( ratioRight - ratioLeft );

    const addColorStops = gradient => {
      gradient.addColorStop( 0, 'black' );

      gradient.addColorStop( newRatio( 0 ), 'white' );
      gradient.addColorStop( newRatio( 0.5 ), 'black' );
      gradient.addColorStop( newRatio( 0.70 ), 'white' );
      gradient.addColorStop( newRatio( 0.74 ), 'black' );
      gradient.addColorStop( newRatio( 0.78 ), 'white' );
      gradient.addColorStop( newRatio( 0.80 ), 'white' );
      gradient.addColorStop( newRatio( 0.82 ), 'black' );
      gradient.addColorStop( newRatio( 0.84 ), 'white' );
      gradient.addColorStop( newRatio( 0.86 ), 'white' );
      gradient.addColorStop( newRatio( 0.87 ), 'black' );
      gradient.addColorStop( newRatio( 0.88 ), 'white' );
      gradient.addColorStop( newRatio( 0.9 ), 'white' );
      gradient.addColorStop( newRatio( 0.905 ), 'black' );
      gradient.addColorStop( newRatio( 0.91 ), 'white' );
      gradient.addColorStop( newRatio( 0.93 ), 'white' );
      gradient.addColorStop( newRatio( 0.9325 ), 'black' );
      gradient.addColorStop( newRatio( 0.935 ), 'white' );
      gradient.addColorStop( newRatio( 0.95 ), 'white' );
      gradient.addColorStop( newRatio( 0.951 ), 'black' );
      gradient.addColorStop( newRatio( 0.952 ), 'white' );

      gradient.addColorStop( 1, 'black' );
    };

    const linear = new LinearGradient( left, 0, right, 0 );
    addColorStops( linear );

    const radial = new RadialGradient( left, 64, 0, left, 64, right - left );
    addColorStops( radial );

    const scene = new Node( {
      children: [
        new Path( Shape.polygon( [
          v2( 0, 0 ),
          v2( 128, 0 ),
          v2( 128, 64 ),
          v2( 0, 64 )
        ] ), { fill: linear } ),
        new Path( Shape.polygon( [
          v2( 0, 64 ),
          v2( 128, 64 ),
          v2( 128, 128 ),
          v2( 0, 128 )
        ] ), { fill: radial } )
      ]
    } );

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        scene, width, height, 'white', type
      );
    }
    else {
      const program = RenderFromNode.addBackgroundColor( RenderFromNode.nodeToRenderProgram( scene ), Color.WHITE );

      return window.getRasterizedElement( program, width, height, {
        polygonFiltering: {
          box: PolygonFilterType.Box,
          bilinear: PolygonFilterType.Bilinear,
          mitchellNetravali: PolygonFilterType.MitchellNetravali
        }[ type ]
      } );
    }
  };

  window.addDiagram( 'gradientPrecision-canvas', () => getGradientPrecision( 'canvas' ) );
  window.addDiagram( 'gradientPrecision-svg', () => getGradientPrecision( 'svg' ) );
  window.addDiagram( 'gradientPrecision-box', () => getGradientPrecision( 'box' ) );
}

{
  const getColorSpaceGradients = ( a, b ) => {
    const width = 256;
    const height = 96;

    const clientSpace = RenderColorSpace.premultipliedSRGB;

    const colorSpaces = [
      RenderColorSpace.premultipliedOklab,
      RenderColorSpace.premultipliedLinearSRGB,
      RenderColorSpace.premultipliedSRGB
    ];

    const getTwoStop = ( minY, maxY, color1, color2, colorSpace ) => {
      return new RenderPathBoolean(
        new RenderPath( 'nonzero', [ [
          phet.dot.v2( 0, minY ),
          phet.dot.v2( width, minY ),
          phet.dot.v2( width, maxY ),
          phet.dot.v2( 0, maxY )
        ] ] ),
        new RenderLinearGradient(
          Matrix3.IDENTITY,
          v2( 0, 0 ),
          v2( width, 0 ),
          [
            new RenderGradientStop( 0, RenderFromNode.colorFrom( color1 ).colorConverted( clientSpace, colorSpace ) ),
            new RenderGradientStop( 1, RenderFromNode.colorFrom( color2 ).colorConverted( clientSpace, colorSpace ) )
          ],
          RenderExtend.Pad,
          RenderLinearGradientAccuracy.SplitAccurate
        ).colorConverted( colorSpace, clientSpace ),
        RenderColor.TRANSPARENT
      );
    };

    const program = new RenderStack( [
      RenderFromNode.colorFrom( 'black' ),
      getTwoStop( 0, 32, a, b, colorSpaces[ 0 ] ),
      getTwoStop( 32, 64, a, b, colorSpaces[ 1 ] ),
      getTwoStop( 64, 96, a, b, colorSpaces[ 2 ] )
    ] );
    return window.getRasterizedElement( program, width, height );
  };

  window.addDiagram( 'redGreenGradients-example', () => getColorSpaceGradients( 'red', 'rgba(0,255,0,1)' ) );
  window.addDiagram( 'blueWhiteGradients-example', () => getColorSpaceGradients( 'blue', 'white' ) );
}

{
  const getGamut = ( renderType, displayType, blendType, showOutOfGamut = false ) => {
    const sideLength = 200;
    const triangleHeight = Math.sqrt( 3 ) / 2 * sideLength;

    const padding = 3;

    const width = sideLength + padding * 2;
    const height = Math.ceil( triangleHeight ) + padding * 2;

    const redPoint = v2( 0, triangleHeight ).plusScalar( padding );
    const greenPoint = v2( sideLength, triangleHeight ).plusScalar( padding );
    const bluePoint = v2( sideLength / 2, 0 ).plusScalar( padding );

    const rawRedColor = v4( 1, 0, 0, 1 );
    const rawGreenColor = v4( 0, 1, 0, 1 );
    const rawBlueColor = v4( 0, 0, 1, 1 );

    const sRGB = RenderColorSpace.premultipliedSRGB;
    const displayP3 = RenderColorSpace.premultipliedDisplayP3;
    const oklab = RenderColorSpace.premultipliedOklab;

    const rawRedSRGBColor = RenderColor.convert( rawRedColor.copy(), sRGB, displayP3 );
    const rawGreenSRGBColor = RenderColor.convert( rawGreenColor.copy(), sRGB, displayP3 );
    const rawBlueSRGBColor = RenderColor.convert( rawBlueColor.copy(), sRGB, displayP3 );

    const clientSpace = displayType === 'srgb' ? sRGB : displayP3;
    const blendSpace = blendType === 'srgb' ? sRGB : ( blendType === 'display-p3' ? displayP3 : oklab );

    const program = new RenderStack( [
      new RenderPathBoolean(
        new RenderPath( 'nonzero', [ [
          redPoint, greenPoint, bluePoint
        ] ] ),
        new RenderBarycentricBlend(
          redPoint, greenPoint, bluePoint,
          RenderBarycentricBlendAccuracy.Accurate,
          new RenderColor( renderType === 'srgb' ? rawRedSRGBColor : rawRedColor ).colorConverted( displayP3, blendSpace ),
          new RenderColor( renderType === 'srgb' ? rawGreenSRGBColor : rawGreenColor ).colorConverted( displayP3, blendSpace ),
          new RenderColor( renderType === 'srgb' ? rawBlueSRGBColor : rawBlueColor ).colorConverted( displayP3, blendSpace )
        ).colorConverted( blendSpace, clientSpace ),
        RenderColor.TRANSPARENT
      ),
      new RenderPathBoolean(
        new RenderPath( 'nonzero', shapeToPolygons( Shape.polygon( [ redPoint, greenPoint, bluePoint ] ).getStrokedShape( new LineStyles( { lineWidth: 0.5 } ) ) ) ),
        RenderFromNode.colorFrom( 'black' ).colorConverted( sRGB, clientSpace ),
        RenderColor.TRANSPARENT
      )
    ] );
    return window.getRasterizedElement( program, width, height, {
      colorSpace: displayType,
      showOutOfGamut: showOutOfGamut
    } );
  };

  window.addDiagram( 'sRGBGamutMap-example', () => getGamut( 'srgb', 'srgb', 'oklab' ) );
  window.addDiagram( 'sRGBNoGamutMap-example', () => getGamut( 'srgb', 'srgb', 'oklab', true ) );
  if ( window.matchMedia( '(color-gamut: p3)' ).matches ) {
    window.addDiagram( 'displayP3GamutMap-example', () => getGamut( 'display-p3', 'display-p3', 'oklab' ) );
  }
}

{
  const getColorSpaceComparison = ( isWideGamut, colorSpace ) => {
    const width = 206;
    const height = 32;

    const clientSpace = isWideGamut ? RenderColorSpace.premultipliedDisplayP3 : RenderColorSpace.premultipliedSRGB;
    const blendSpace = RenderColorSpace.premultipliedOklab;

    const getTwoStop = ( minY, maxY ) => {
      return new RenderPathBoolean(
        new RenderPath( 'nonzero', [ [
          phet.dot.v2( 0, minY ),
          phet.dot.v2( width, minY ),
          phet.dot.v2( width, maxY ),
          phet.dot.v2( 0, maxY )
        ] ] ),
        new RenderLinearGradient(
          Matrix3.IDENTITY,
          v2( 0, 0 ),
          v2( width, 0 ),
          [
            new RenderGradientStop( 0, RenderFromNode.colorFrom( 'rgba(255,0,0,1)' ).colorConverted( colorSpace, blendSpace ) ),
            new RenderGradientStop( 1, RenderFromNode.colorFrom( 'rgba(0,255,0,1)' ).colorConverted( colorSpace, blendSpace ) )
          ],
          RenderExtend.Pad,
          RenderLinearGradientAccuracy.SplitAccurate
        ).colorConverted( blendSpace, clientSpace ),
        RenderColor.TRANSPARENT
      );
    };

    const program = getTwoStop( 0, height );
    return window.getRasterizedElement( program, width, height, {
      colorSpace: isWideGamut ? 'display-p3' : 'srgb'
    } );
  };

  window.addDiagram( 'displayP3Comparison-example', () => {
    const sRGB = getColorSpaceComparison( false, RenderColorSpace.premultipliedSRGB );
    const displayP3 = getColorSpaceComparison( true, RenderColorSpace.premultipliedDisplayP3 );
    const sRGBMapped = getColorSpaceComparison( false, RenderColorSpace.premultipliedDisplayP3 );
    const div = document.createElement( 'div' );

    div.appendChild( sRGB );
    div.appendChild( displayP3 );
    div.appendChild( sRGBMapped );

    const margin = ( 180 - 32 * 3 ) / 2;
    sRGB.style.marginTop = `${margin}px`;
    div.style.height = `${180 - margin}px`;
    return div;
  } );
}

{
  const getUpscaling = type => {
    const width = 128;
    const height = 128;

    const matrix = Matrix3.translation( 0, -50 ).timesMatrix( Matrix3.rotationZ( 0.1 ) ).timesMatrix( Matrix3.scaling( 7 ) );

    const testSmallImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAadJREFUWEft1r+L0nEcx/GHctDUL6cEob/B26OjqSQTokEHIQsaajhwCdyavEW8IZXWlszWCC5Xuy3hziFBCBqKHG4RCSE4Q7O4uzoOz45r+H7Gz+f9fn9e7+fnDa9PaDwej53iCgUCAgIBgYBAQOC/ILC5uWk0Gv3hCCsrK8Lh8Ik6xdQL1tfXDQYDrVbLzs6OVCo1vbRQKFhaWjpSQD6fl81mxePxI2MPBuwzo3K5rNfrqVarJiZZLBbVajWxWEylUrG8vKxer0/3h8OhtbU1u7u70un0NGZra0skEplLxKECtre3ZTIZjUZDs9lUKpV0u13RaFSn09Hv9+VyOe12WzKZtLq6KpFICIVCcwrg93+gjB6qKOIdbs/K3ccn3MElZHEdZ3ETj3Flrqt/BofGhwh4iC+4uqfoXXzHS7xCHx9w6yQEvMZzvMBn3MAG7uHNRDkuoosHyOPavyTwDZOO3+MjnuLRDP1bXMZk5p/hyezZJjTmG8EDT/C3Br7izKzbX+eTWTiPC3sSBji3KIFj5C+csm8IF652jAKBgIBAQCAgcOoEfgBe/tbBIOxj8QAAAABJRU5ErkJggg==';
    const testSmallData = [
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 197, 197, 197, 255, 189, 189, 189, 255, 189, 189, 189, 255, 189, 189, 189, 255, 189, 189, 189, 255, 189, 189, 189, 255, 253, 253, 253, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 143, 143, 143, 255, 129, 129, 129, 255, 69, 69, 69, 255, 50, 50, 50, 255, 129, 129, 129, 255, 129, 129, 129, 255, 251, 251, 251, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 113, 113, 113, 255, 206, 206, 206, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 142, 142, 142, 255, 105, 105, 105, 255, 255, 255, 255, 255, 254, 254, 254, 255, 133, 133, 133, 255, 28, 28, 28, 255, 56, 56, 56, 255, 205, 205, 205, 255, 255, 255, 255, 255, 167, 167, 167, 255, 46, 46, 46, 255, 34, 34, 34, 255, 170, 170, 170, 255, 168, 168, 168, 255, 0, 0, 0, 255, 28, 28, 28, 255, 237, 237, 237, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 142, 142, 142, 255, 105, 105, 105, 255, 255, 255, 255, 255, 209, 209, 209, 255, 42, 42, 42, 255, 212, 212, 212, 255, 143, 143, 143, 255, 28, 28, 28, 255, 244, 244, 244, 255, 13, 13, 13, 255, 224, 224, 224, 255, 201, 201, 201, 255, 42, 42, 42, 255, 248, 248, 248, 255, 69, 69, 69, 255, 180, 180, 180, 255, 254, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 142, 0, 0, 255, 105, 0, 0, 255, 255, 0, 0, 255, 134, 0, 0, 255, 75, 0, 0, 255, 157, 0, 0, 255, 157, 0, 0, 255, 0, 0, 0, 255, 225, 0, 0, 255, 53, 0, 0, 255, 77, 0, 0, 255, 170, 0, 0, 255, 242, 0, 0, 255, 255, 0, 0, 255, 75, 0, 0, 255, 194, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 142, 0, 0, 255, 105, 0, 0, 255, 255, 0, 0, 255, 105, 0, 0, 255, 79, 0, 0, 255, 142, 0, 0, 255, 142, 0, 0, 255, 142, 0, 0, 255, 238, 0, 0, 255, 233, 0, 0, 255, 146, 0, 0, 255, 61, 0, 0, 255, 38, 0, 0, 255, 253, 0, 0, 255, 75, 0, 0, 255, 194, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 142, 0, 0, 255, 105, 0, 0, 255, 255, 0, 0, 255, 179, 0, 0, 255, 85, 0, 0, 255, 252, 0, 0, 255, 225, 0, 0, 255, 42, 0, 0, 255, 227, 0, 0, 255, 69, 0, 0, 255, 251, 0, 0, 255, 252, 0, 0, 255, 13, 0, 0, 255, 229, 0, 0, 255, 75, 0, 0, 255, 189, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 142, 0, 0, 255, 105, 0, 0, 255, 255, 0, 0, 255, 245, 0, 0, 255, 85, 0, 0, 255, 34, 0, 0, 255, 0, 0, 0, 255, 148, 0, 0, 255, 255, 0, 0, 255, 92, 0, 0, 255, 22, 0, 0, 255, 53, 0, 0, 255, 102, 0, 0, 255, 255, 0, 0, 255, 128, 0, 0, 255, 22, 0, 0, 255, 237, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 231, 0, 0, 255, 238, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 224, 0, 0, 255, 239, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 241, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255
    ];
    const testSmallCanvas = document.createElement( 'canvas' );
    testSmallCanvas.width = 32;
    testSmallCanvas.height = 32;
    const testSmallContext = testSmallCanvas.getContext( '2d' );
    const testSmallImageData = new ImageData( 32, 32 );
    testSmallImageData.data.set( testSmallData );
    testSmallContext.putImageData( testSmallImageData, 0, 0 );
    const testSmallImageImage = document.createElement( 'img' );
    testSmallImageImage.src = testSmallImage; // Hopefully it loads in time?

    const linearPremultipliedTestImageData = [];
    for ( let i = 0; i < testSmallData.length / 4; i++ ) {
      const baseIndex = i * 4;
      const r = testSmallData[ baseIndex ] / 255;
      const g = testSmallData[ baseIndex + 1 ] / 255;
      const b = testSmallData[ baseIndex + 2 ] / 255;
      const a = testSmallData[ baseIndex + 3 ] / 255;
      const srgb = new Vector4( r, g, b, a );
      const linear = RenderColor.sRGBToLinear( srgb );
      const premultiplied = RenderColor.premultiply( linear );
      linearPremultipliedTestImageData.push( premultiplied );
    }

    const testSmallImageablePremultiplied = {
      width: 32,
      height: 32,
      isFullyOpaque: true,
      evaluate: ( x, y ) => {
        return linearPremultipliedTestImageData[ y * testSmallImageData.width + x ];
      }
    };


    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        new Image( type === 'svg' ? testSmallImageImage : testSmallCanvas, {
          renderer: type,
          matrix: matrix
        } ), width, height, 'white', type
      );
      // TODO: why white?
    }
    else {
      const program = new RenderLinearSRGBToSRGB( new RenderImage(
        matrix,
        testSmallImageablePremultiplied,
        RenderExtend.Pad,
        RenderExtend.Pad,
        type
      ) );
      return window.getRasterizedElement( program, width, height );
    }
  };

  window.addDiagram( 'upsampling-canvas', () => getUpscaling( 'canvas' ) );
  window.addDiagram( 'upsampling-svg', () => getUpscaling( 'svg' ) );
  window.addDiagram( 'upsampling-analytic-box', () => getUpscaling( RenderResampleType.AnalyticBox ) );
  window.addDiagram( 'upsampling-mitchell-netravali', () => getUpscaling( RenderResampleType.MitchellNetravali ) );
}

{
  const getDownscaling = async type => {

    const width = 128;
    const height = 128;

    const matrix0 = Matrix3.translation( 0, 0 ).timesMatrix( Matrix3.rotationZ( 0.1 ) ).timesMatrix( Matrix3.scaling( 0.1 ) );
    const matrix1 = Matrix3.translation( 80, 100 ).timesMatrix( Matrix3.rotationZ( -0.4 ) ).timesMatrix( Matrix3.scaling( 0.04 ) );


    const testLargeImage = document.createElement( 'img' );
    testLargeImage.src = './doc/downscale.png';

    const testLargelinearPremultipliedTestImageData = [];

    await testLargeImage.decode();

    const canvas = document.createElement( 'canvas' );
    canvas.width = testLargeImage.width;
    canvas.height = testLargeImage.height;
    const context = canvas.getContext( '2d' );
    context.drawImage( testLargeImage, 0, 0 );
    const imageData = context.getImageData( 0, 0, testLargeImage.width, testLargeImage.height );

    for ( let i = 0; i < imageData.data.length / 4; i++ ) {
      const baseIndex = i * 4;
      const r = imageData.data[ baseIndex ] / 255;
      const g = imageData.data[ baseIndex + 1 ] / 255;
      const b = imageData.data[ baseIndex + 2 ] / 255;
      const a = imageData.data[ baseIndex + 3 ] / 255;
      const srgb = new Vector4( r, g, b, a );
      const linear = RenderColor.sRGBToLinear( srgb );
      const premultiplied = RenderColor.premultiply( linear );
      testLargelinearPremultipliedTestImageData.push( premultiplied );
    }

    const testLargeImageablePremultiplied = {
      width: imageData.width,
      height: imageData.height,
      isFullyOpaque: true,
      evaluate: ( x, y ) => {
        return testLargelinearPremultipliedTestImageData[ y * imageData.width + x ];
      }
    };

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        new Node( {
          children: [
            new Image( testLargeImage, {
              renderer: type,
              matrix: matrix0
            } ),
            new Image( testLargeImage, {
              renderer: type,
              matrix: matrix1
            } )
          ]
        } ),
        width, height, 'transparent', type
      );
    }
    else {
      const program = new RenderStack( [
        RenderPathBoolean.fromInside( RenderPath.fromBounds( new Bounds2( 0, 0, 1000, 1000 ) ).transformed( matrix0 ), new RenderLinearSRGBToSRGB( new RenderImage(
          matrix0,
          testLargeImageablePremultiplied,
          RenderExtend.Pad,
          RenderExtend.Pad,
          type
        ) ) ),
        RenderPathBoolean.fromInside( RenderPath.fromBounds( new Bounds2( 0, 0, 1000, 1000 ) ).transformed( matrix1 ), new RenderLinearSRGBToSRGB( new RenderImage(
          matrix1,
          testLargeImageablePremultiplied,
          RenderExtend.Pad,
          RenderExtend.Pad,
          type
        ) ) )
      ] );
      return window.getRasterizedElement( program, width, height );
    }
  };

  window.addDiagram( 'downsampling-canvas', () => getDownscaling( 'canvas' ) );
  window.addDiagram( 'downsampling-svg', () => getDownscaling( 'svg' ) );
  window.addDiagram( 'downsampling-analytic-box', () => getDownscaling( RenderResampleType.AnalyticBox ) );
  window.addDiagram( 'downsampling-analytic-bilinear', () => getDownscaling( RenderResampleType.AnalyticBilinear ) );
  window.addDiagram( 'downsampling-analytic-mitchell-netravali', () => getDownscaling( RenderResampleType.AnalyticMitchellNetravali ) );
}

{
  const outputSize = 256;
  const size = 10;
  const padding = 40;

  const matrix = phet.dot.Matrix3.translation( padding, padding ).timesMatrix( phet.dot.Matrix3.scaling( ( outputSize - 2 * padding ) / size ) );
  const bounds = new phet.dot.Bounds2( 0, 0, 10, 10 );

  const dottedRect = phet.scenery.Rectangle.bounds( bounds.transformed( matrix ), {
    stroke: 'black',
    lineWidth: 0.5,
    lineDash: [ 2, 2 ]
  } );

  const v2 = phet.dot.v2;
  const polygons = [
    [
      v2( 0, 0 ),
      v2( 10, 0 ),
      v2( 10, 2 ),
      v2( 2, 10 ),
      v2( 0, 10 )
    ],
    [
      v2( 2, 2 ),
      v2( 2, 7 ),
      v2( 7, 2 )
    ],
    [
      v2( 9, 9 ),
      v2( 6, 9 ),
      v2( 9, 6 )
    ]
  ];

  const shape = phet.alpenglow.LinearEdge.polygonsToShape( polygons ).transformed( matrix );
  const edges = phet.alpenglow.LinearEdge.fromPolygons( polygons );

  const filledPath = new phet.scenery.Path( shape, {
    fill: 'rgba(255,0,0,0.7)'
  } );

  const arrowOptions = {
    headHeight: 6,
    headWidth: 4,
    tailWidth: 0.2
  };

  const arrowsNode = new phet.scenery.Node( {
    children: edges.map( edge => {
      const start = matrix.timesVector2( edge.startPoint );
      const end = matrix.timesVector2( edge.endPoint );
      return new ArrowNode( start.x, start.y, end.x, end.y, arrowOptions );
    } )
  } );

  const edgeClippedArrowsNode = new phet.scenery.Node( {
    children: edges.map( edge => {
      if ( ( edge.startPoint.x === 0 && edge.startPoint.y === 0 ) || ( edge.endPoint.x === 0 && edge.endPoint.y === 0 ) ) {
        return null;
      }
      const start = matrix.timesVector2( edge.startPoint );
      const end = matrix.timesVector2( edge.endPoint );
      return new ArrowNode( start.x, start.y, end.x, end.y, arrowOptions );
    } ).filter( _.identity )
  } );

  const toArray = v => [ v.x, v.y ];
  const extraArrowsNode = new phet.scenery.Node( {
    children: [
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 10, 1.93 ) ) ),
        ...toArray( matrix.timesVector2( v2( 7, 1.93 ) ) ),
        arrowOptions
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 7, 2.07 ) ) ),
        ...toArray( matrix.timesVector2( v2( 10, 2.07 ) ) ),
        arrowOptions
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 2, 7.08 ) ) ),
        ...toArray( matrix.timesVector2( v2( 6, 9.08 ) ) ),
        arrowOptions
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 6, 8.92 ) ) ),
        ...toArray( matrix.timesVector2( v2( 2, 6.92 ) ) ),
        arrowOptions
      )
    ]
  } );

  const edgeClipArrowsNode = new phet.scenery.Node( {
    children: [
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 0, 0 ) ) ),
        ...toArray( matrix.timesVector2( v2( 0, 10 ) ) ),
        phet.phetCore.merge( { fill: 'red', stroke: 'red' }, arrowOptions )
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 0, 0 ) ) ),
        ...toArray( matrix.timesVector2( v2( 10, 0 ) ) ),
        phet.phetCore.merge( { fill: 'red', stroke: 'red' }, arrowOptions )
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 10, 0 ) ) ),
        ...toArray( matrix.timesVector2( v2( 10, 10 ) ) ),
        phet.phetCore.merge( { fill: 'red', stroke: 'red' }, arrowOptions )
      ),
      new ArrowNode(
        ...toArray( matrix.timesVector2( v2( 0, 10 ) ) ),
        ...toArray( matrix.timesVector2( v2( 10, 10 ) ) ),
        phet.phetCore.merge( { fill: 'red', stroke: 'red' }, arrowOptions )
      )
    ]
  } );

  const edgeClipArrowLabelsNode = new phet.scenery.Node( {
    children: [
      new phet.scenery.Text( 'minY', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 5, -0.1 ) ) } ),
      new phet.scenery.Text( 'maxY', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 5, 10.1 ) ) } ),
      new phet.scenery.Text( 'minX', { font: window.diagramFont, rightCenter: matrix.timesVector2( v2( -0.1, 5 ) ) } ),
      new phet.scenery.Text( 'maxX', { font: window.diagramFont, leftCenter: matrix.timesVector2( v2( 10.1, 5 ) ) } )
    ]
  } );

  const edgeClippedArrowLabelsNode = new phet.scenery.Node( {
    children: [
      new phet.scenery.Text( '+1', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 5, -0.1 ) ) } ),
      new phet.scenery.Text( '0', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 5, 10.1 ) ) } ),
      new phet.scenery.Text( '-1', { font: window.diagramFont, rightCenter: matrix.timesVector2( v2( -0.1, 5 ) ) } ),
      new phet.scenery.Text( '0', { font: window.diagramFont, leftCenter: matrix.timesVector2( v2( 10.1, 5 ) ) } )
    ]
  } );

  const coordinateLabelsNode = new phet.scenery.Node( {
    children: [
      new phet.scenery.Text( '(0,0)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 0, -0.1 ) ) } ),
      new phet.scenery.Text( '(0,10)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 0, 10.1 ) ) } ),
      new phet.scenery.Text( '(10,0)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 10, -0.1 ) ) } ),
      new phet.scenery.Text( '(9,9)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 9, 9.1 ) ) } ),
      new phet.scenery.Text( '(6,9)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 6, 9.1 ) ) } ),
      new phet.scenery.Text( '(9,6)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 9, 5.9 ) ) } ),
      new phet.scenery.Text( '(2,10)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 2, 10.1 ) ) } ),
      new phet.scenery.Text( '(10,2)', { font: window.diagramFont, leftCenter: matrix.timesVector2( v2( 10.1, 2 ) ) } ),
      new phet.scenery.Text( '(2,2)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 2, 1.9 ) ) } ),
      new phet.scenery.Text( '(7,2)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 7, 1.9 ) ) } ),
      new phet.scenery.Text( '(2,7)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 2, 7.1 ) ) } )
    ]
  } );

  const cornerCoordinateLabelsNode = new phet.scenery.Node( {
    children: [
      new phet.scenery.Text( '(0,0)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 0, -0.1 ) ) } ),
      new phet.scenery.Text( '(0,10)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 0, 10.1 ) ) } ),
      new phet.scenery.Text( '(10,0)', { font: window.diagramFont, centerBottom: matrix.timesVector2( v2( 10, -0.1 ) ) } ),
      new phet.scenery.Text( '(10,10)', { font: window.diagramFont, centerTop: matrix.timesVector2( v2( 10, 10.1 ) ) } )
    ]
  } );

  // TODO: factor some of this code out...
  window.addDiagram( 'polygonal-face-example', () => window.createSceneryDiagram(
    new phet.scenery.Node( {
      children: [
        dottedRect,
        filledPath,
        arrowsNode,
        coordinateLabelsNode
      ]
    } ),
    outputSize, outputSize, true
  ) );

  window.addDiagram( 'polygonal-face-canceling', () => window.createSceneryDiagram(
    new phet.scenery.Node( {
      children: [
        dottedRect,
        filledPath,
        arrowsNode,
        extraArrowsNode
      ]
    } ),
    outputSize, outputSize, true
  ) );

  window.addDiagram( 'polygonal-face-edge-clips', () => window.createSceneryDiagram(
    new phet.scenery.Node( {
      children: [
        dottedRect,
        edgeClipArrowsNode,
        cornerCoordinateLabelsNode,
        edgeClipArrowLabelsNode
      ]
    } ),
    outputSize, outputSize, true
  ) );

  window.addDiagram( 'polygonal-face-edge-clipped', () => window.createSceneryDiagram(
    new phet.scenery.Node( {
      children: [
        dottedRect,
        filledPath,
        edgeClippedArrowsNode,
        coordinateLabelsNode,
        edgeClippedArrowLabelsNode
      ]
    } ),
    outputSize, outputSize, true
  ) );
}

{
  const outputSize = 256;
  const size = 10;
  const padding = 70;

  const matrix = phet.dot.Matrix3.translation( padding, padding ).timesMatrix( phet.dot.Matrix3.scaling( ( outputSize - 2 * padding ) / size ) );
  const bounds = new phet.dot.Bounds2( 0, 0, 10, 10 );

  const clipRect = phet.scenery.Rectangle.bounds( bounds.transformed( matrix ), {
    stroke: 'black',
    fill: 'white'
  } );

  const exteriorShape = new phet.kite.Shape();
  const interiorShape = new phet.kite.Shape();

  const v2 = phet.dot.v2;
  const LinearEdge = phet.alpenglow.LinearEdge;
  const edges = [
    new LinearEdge( v2( -2, 7 ), v2( 7, -2 ) ),
    new LinearEdge( v2( 3, 4 ), v2( 9, 6 ) ),
    new LinearEdge( v2( 5, -5 ), v2( 15, 4 ) ),
    new LinearEdge( v2( 4, 7 ), v2( 9, 12 ) ),
    new LinearEdge( v2( 2, 10 ), v2( 1, 13 ) ),
    new LinearEdge( v2( 0, 9 ), v2( 2, 9 ) )
  ];

  for ( let i = 0; i < edges.length; i++ ) {
    const start = edges[ i ].startPoint.copy();
    const end = edges[ i ].endPoint.copy();

    const fullStart = start.copy();
    const fullEnd = end.copy();

    const clipped = phet.alpenglow.LineClipping.matthesDrakopoulosClip( start, end, 0, 0, 10, 10 );

    if ( clipped ) {
      if ( !start.equals( fullStart ) ) {
        exteriorShape.moveToPoint( matrix.timesVector2( fullStart ) );
        exteriorShape.lineToPoint( matrix.timesVector2( start ) );
      }

      if ( !start.equals( end ) ) {
        interiorShape.moveToPoint( matrix.timesVector2( start ) );
        interiorShape.lineToPoint( matrix.timesVector2( end ) );
      }

      if ( !end.equals( fullEnd ) ) {
        exteriorShape.moveToPoint( matrix.timesVector2( end ) );
        exteriorShape.lineToPoint( matrix.timesVector2( fullEnd ) );
      }
    }
    else {
      exteriorShape.moveToPoint( matrix.timesVector2( fullStart ) );
      exteriorShape.lineToPoint( matrix.timesVector2( fullEnd ) );
    }
  }

  const exteriorNode = new phet.scenery.Path( exteriorShape, {
    stroke: 'black',
    opacity: 0.2
  } );
  const interiorNode = new phet.scenery.Path( interiorShape, {
    stroke: 'red'
  } );

  window.addDiagram( 'clipping-line-example', () => window.createSceneryDiagram(
    new phet.scenery.Node( {
      children: [
        clipRect,
        exteriorNode,
        interiorNode
      ]
    } ),
    outputSize, outputSize, true
  ) );
}

{
  const scene = new Node();

  const shapeAData = 'M 35.20000000000000284217 -15.15000000000000035527 L 35.20000000000000284217 -7.20000000000000017764 Q 35.20000000000000284217 -4.22500000000000053291 33.08749999999999857891 -2.11250000000000026645 Q 30.97500000000000142109 0.00000000000000000000 28.00000000000000000000 0.00000000000000000000 L 7.20000000000000017764 0.00000000000000000000 Q 4.22500000000000053291 0.00000000000000000000 2.11250000000000026645 -2.11250000000000026645 Q 0.00000000000000000000 -4.22500000000000053291 0.00000000000000000000 -7.20000000000000017764 L 0.00000000000000000000 -28.00000000000000000000 Q 0.00000000000000000000 -30.97500000000000142109 2.11250000000000026645 -33.08749999999999857891 Q 4.22500000000000053291 -35.20000000000000284217 7.20000000000000017764 -35.20000000000000284217 L 28.00000000000000000000 -35.20000000000000284217 Q 29.57500000000000284217 -35.20000000000000284217 30.92500000000000071054 -34.57500000000000284217 Q 31.30000000000000071054 -34.39999999999999857891 31.37500000000000000000 -34.00000000000000000000 Q 31.45000000000000284217 -33.57500000000000284217 31.15000000000000213163 -33.27499999999999857891 L 29.92500000000000071054 -32.05000000000000426326 Q 29.67500000000000071054 -31.80000000000000071054 29.35000000000000142109 -31.80000000000000071054 Q 29.27500000000000213163 -31.80000000000000071054 29.12500000000000000000 -31.85000000000000142109 Q 28.55000000000000071054 -32.00000000000000000000 28.00000000000000000000 -32.00000000000000000000 L 7.20000000000000017764 -32.00000000000000000000 Q 5.55000000000000071054 -32.00000000000000000000 4.37500000000000000000 -30.82500000000000284217 Q 3.20000000000000017764 -29.65000000000000213163 3.20000000000000017764 -28.00000000000000000000 L 3.20000000000000017764 -7.20000000000000017764 Q 3.20000000000000017764 -5.55000000000000071054 4.37500000000000000000 -4.37500000000000000000 Q 5.55000000000000071054 -3.20000000000000017764 7.20000000000000017764 -3.20000000000000017764 L 28.00000000000000000000 -3.20000000000000017764 Q 29.65000000000000213163 -3.20000000000000017764 30.82500000000000284217 -4.37500000000000000000 Q 32.00000000000000000000 -5.55000000000000071054 32.00000000000000000000 -7.20000000000000017764 L 32.00000000000000000000 -13.55000000000000071054 Q 32.00000000000000000000 -13.87500000000000000000 32.22500000000000142109 -14.10000000000000142109 L 33.82500000000000284217 -15.70000000000000106581 Q 34.07500000000000284217 -15.95000000000000106581 34.39999999999999857891 -15.95000000000000106581 Q 34.55000000000000426326 -15.95000000000000106581 34.70000000000000284217 -15.87500000000000000000 Q 35.20000000000000284217 -15.67500000000000071054 35.20000000000000284217 -15.15000000000000035527 Z M 40.97500000000000142109 -27.37500000000000000000 L 20.62500000000000000000 -7.02500000000000035527 Q 20.02500000000000213163 -6.42500000000000071054 19.20000000000000284217 -6.42500000000000071054 Q 18.37500000000000000000 -6.42500000000000071054 17.77500000000000213163 -7.02500000000000035527 L 7.02500000000000035527 -17.77500000000000213163 Q 6.42500000000000071054 -18.37500000000000000000 6.42500000000000071054 -19.20000000000000284217 Q 6.42500000000000071054 -20.02500000000000213163 7.02500000000000035527 -20.62500000000000000000 L 9.77500000000000035527 -23.37500000000000000000 Q 10.37500000000000000000 -23.97500000000000142109 11.20000000000000106581 -23.97500000000000142109 Q 12.02500000000000035527 -23.97500000000000142109 12.62500000000000000000 -23.37500000000000000000 L 19.20000000000000284217 -16.80000000000000071054 L 35.37500000000000000000 -32.97500000000000142109 Q 35.97500000000000142109 -33.57500000000000284217 36.80000000000000426326 -33.57500000000000284217 Q 37.62500000000000000000 -33.57500000000000284217 38.22500000000000142109 -32.97500000000000142109 L 40.97500000000000142109 -30.22500000000000142109 Q 41.57500000000000284217 -29.62500000000000000000 41.57500000000000284217 -28.80000000000000071054 Q 41.57500000000000284217 -27.97500000000000142109 40.97500000000000142109 -27.37500000000000000000 Z';
  const shapeBData = 'M 320.00000000000000000000 400.00000000000000000000 C 244.15000000000000568434 400.00000000000000000000 182.75000000000000000000 341.29000000000002046363 177.09999999999999431566 266.88999999999998635758 L 72.20000000000000284217 185.81999999999999317879 C 58.41000000000000369482 203.12000000000000454747 45.71999999999999886313 221.40999999999999658939 35.48000000000000397904 241.40999999999999658939 A 32.35000000000000142109 32.35000000000000142109 0 0 0 35.48000000000000397904 270.60000000000002273737 C 89.70999999999999374722 376.41000000000002501110 197.06999999999999317879 448.00000000000000000000 320.00000000000000000000 448.00000000000000000000 C 346.91000000000002501110 448.00000000000000000000 372.87000000000000454747 444.00000000000000000000 397.88999999999998635758 437.54000000000002046363 L 346.00000000000000000000 397.38999999999998635758 A 144.12999999999999545253 144.12999999999999545253 0 0 1 319.99999999999994315658 400.00000000000000000000 Z M 633.81999999999993633537 458.10000000000002273737 L 523.26999999999998181011 372.66000000000002501110 A 331.25000000000000000000 331.25000000000000000000 0 0 0 604.51999999999998181011 270.59000000000003183231 A 32.35000000000000142109 32.35000000000000142109 0 0 0 604.51999999999998181011 241.40000000000003410605 C 550.28999999999996362021 135.59000000000000341061 442.93000000000000682121 64.00000000000000000000 320.00000000000000000000 64.00000000000000000000 A 308.14999999999997726263 308.14999999999997726263 0 0 0 172.68000000000000682121 101.69999999999987494448 L 45.46000000000000085265 3.37000000000000010658 A 16.00000000000000000000 16.00000000000000000000 0 0 0 23.00000000000000710543 6.17999999999999616307 L 3.37000000000000010658 31.44999999999999928946 A 16.00000000000000000000 16.00000000000000000000 0 0 0 6.18000000000001215028 53.89999999999999857891 L 594.53999999999996362021 508.62999999999999545253 A 16.00000000000000000000 16.00000000000000000000 0 0 0 617.00000000000000000000 505.81999999999999317879 L 636.63999999999998635758 480.55000000000001136868 A 16.00000000000000000000 16.00000000000000000000 0 0 0 633.81999999999993633537 458.10000000000007958079 Z M 450.09999999999990905053 316.10000000000002273737 L 410.79999999999989768185 285.72000000000002728484 A 94.75000000000000000000 94.75000000000000000000 0 0 0 416.00000000000000000000 256.00000000000005684342 A 94.76000000000000511591 94.76000000000000511591 0 0 0 294.68999999999982719601 163.79000000000007730705 A 47.64999999999999857891 47.64999999999999857891 0 0 1 304.00000000000000000000 192.00000000000000000000 A 46.64000000000000056843 46.64000000000000056843 0 0 1 302.46000000000003637979 201.99999999999988631316 L 228.84999999999996589395 145.11000000000001364242 A 142.31000000000000227374 142.31000000000000227374 0 0 1 319.99999999999994315658 112.00000000000000000000 A 143.91999999999998749445 143.91999999999998749445 0 0 1 464.00000000000000000000 256.00000000000005684342 C 464.00000000000000000000 277.62999999999999545253 458.70999999999997953637 297.79000000000002046363 450.10000000000002273737 316.11000000000001364242 L 450.09999999999990905053 316.10000000000002273737 Z';

  const polygonsA = window.shapeToPolygons( new phet.kite.Shape( shapeAData ) ).map( subpath => subpath.map( point => {
    return phet.dot.v2( 15 * ( point.x + 0 ) + 20, 15 * ( point.y + 37 ) + 20 ).timesScalar( 0.5 );
  } ) );
  const polygonsB = window.shapeToPolygons( new phet.kite.Shape( shapeBData ) ).map( subpath => subpath.map( point => {
    return phet.dot.v2( point.x + 20, point.y + 20 ).timesScalar( 0.5 );
  } ) );

  const pathA = new RenderPath( 'nonzero', polygonsA );
  const pathB = new RenderPath( 'nonzero', polygonsB );

  const overlaps = PolygonalBoolean.getOverlaps( pathA, pathB );

  scene.addChild( new Path( LinearEdge.polygonsToShape( overlaps.intersection ), {
    fill: 'rgba(0,0,255,0.5)'
  } ) );
  scene.addChild( new Path( LinearEdge.polygonsToShape( overlaps.aOnly ), {
    fill: 'rgba(255,0,0,0.5)'
  } ) );
  scene.addChild( new Path( LinearEdge.polygonsToShape( overlaps.bOnly ), {
    fill: 'rgba(0,255,0,0.5)'
  } ) );
  scene.addChild( new Path( LinearEdge.polygonsToShape( polygonsA ), {
    stroke: 'red'
  } ) );
  scene.addChild( new Path( LinearEdge.polygonsToShape( polygonsB ), {
    stroke: 'green'
  } ) );

  window.addDiagram( 'boolean-operations-example', () => window.createSceneryDiagram(
    scene,
    340, 300
  ) );
}

{
  // TODO: lazily evaluate these pieces, since it is slowing down our "startup" time


  // TODO: show shape of filter
  // TODO: left diagram shows the polygon over a pixel grid. shows the clipped versions of it (strokes)
  // TODO: arrow between
  // TODO: right diagram shows the box-filtered version (for each pixel)

  const size = 200;

  const createNodes = () => {

    const padding = 4;

    const scale3 = ( size - 2 * padding ) / 3;
    const scale5 = ( size - 2 * padding ) / 5;

    const matrix3 = Matrix3.translation( padding + scale3, padding + scale3 ).timesMatrix( Matrix3.scaling( scale3 ) );
    const matrix5 = Matrix3.translation( padding + 2 * scale5, padding + 2 * scale5 ).timesMatrix( Matrix3.scaling( scale5 ) );

    const shape = new Shape()
      .moveTo( -2, -1 )
      .lineTo( -0.7, -0.5 )
      .lineTo( 0.8, 1.4 )
      .lineTo( 0.3, -0.7 )
      .lineTo( 2.4, 0.5 )
      .lineTo( 3, 2 )
      .lineTo( 3, 3 )
      .lineTo( -2, 3 )
      .close();
    const shape3 = shape.shapeIntersection( Shape.bounds( new Bounds2( -1, -1, 2, 2 ) ) );
    const shape5 = shape.shapeIntersection( Shape.bounds( new Bounds2( -2, -2, 3, 3 ) ) );

    const createGridShape = ( minX, minY, maxX, maxY ) => {
      const gridShape = new Shape();
      for ( let i = minX; i <= maxX; i++ ) {
        gridShape.moveToPoint( v2( i, minY ) );
        gridShape.lineToPoint( v2( i, maxY ) );
      }
      for ( let i = minY; i <= maxY; i++ ) {
        gridShape.moveToPoint( v2( minX, i ) );
        gridShape.lineToPoint( v2( maxX, i ) );
      }
      return gridShape;
    };

    const grid3Node = new Path( createGridShape( -1, -1, 2, 2 ).transformed( matrix3 ), {
      stroke: 'black',
      lineWidth: 0.5,
      lineDash: [ 2, 2 ]
    } );
    const grid5Node = new Path( createGridShape( -2, -2, 3, 3 ).transformed( matrix5 ), {
      stroke: 'black',
      lineWidth: 0.5,
      lineDash: [ 2, 2 ]
    } );

    const fill3Node = new Path( shape3.transformed( matrix3 ), {
      fill: 'rgba(255,0,0,0.7)'
    } );

    const fill5Node = new Path( shape5.transformed( matrix5 ), {
      fill: 'rgba(255,0,0,0.7)'
    } );

    const stroke3Node = new Path( shape3.transformed( matrix3 ), {
      stroke: 'rgba(60,0,0,0.3)'
    } );

    const stroke5Node = new Path( shape5.transformed( matrix5 ), {
      stroke: 'rgba(60,0,0,0.3)'
    } );

    const samples3Node = new Node( {
      children: [
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( -0.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 0.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 1.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( -0.5, 0.5 ) ) } ),
        new Circle( 2, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 0.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 1.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( -0.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 0.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix3.timesVector2( v2( 1.5, 1.5 ) ) } )
      ]
    } );

    const samples5Node = new Node( {
      children: [
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -1.5, -1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -0.5, -1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 0.5, -1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 1.5, -1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 2.5, -1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -1.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -0.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 0.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 1.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 2.5, -0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -1.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -0.5, 0.5 ) ) } ),
        new Circle( 2, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 0.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 1.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 2.5, 0.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -1.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -0.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 0.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 1.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 2.5, 1.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -1.5, 2.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( -0.5, 2.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 0.5, 2.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 1.5, 2.5 ) ) } ),
        new Circle( 1, { fill: 'rgb(0,100,100)', translation: matrix5.timesVector2( v2( 2.5, 2.5 ) ) } )
      ]
    } );

    const boxFilter3Node = new Path( Shape.bounds( new Bounds2( 0, 0, 1, 1 ) ).transformed( matrix3 ), {
      fill: 'rgba(0,100,100,0.7)',
      stroke: 'black',
      lineWidth: 1
    } );

    const boxFilterIntersection3Node = new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0, 0, 1, 1 ) ) ).transformed( matrix3 ), {
      fill: 'rgba(255,0,0,1)',
      stroke: 'black'
    } );

    const bilinearResolution = 256;
    const bilinearFilterImageData = new ImageData( bilinearResolution, bilinearResolution );
    const bilinearFilterIntersectionImageData = new ImageData( bilinearResolution, bilinearResolution );
    for ( let i = 0; i < bilinearResolution; i++ ) {
      const y = 2 * ( i - ( bilinearResolution - 1 ) / 2 ) / bilinearResolution;
      for ( let j = 0; j < bilinearResolution; j++ ) {
        const x = 2 * ( j - ( bilinearResolution - 1 ) / 2 ) / bilinearResolution;

        const value = ( 1 - Math.abs( x ) ) * ( 1 - Math.abs( y ) );
        bilinearFilterImageData.data[ 4 * ( i * bilinearResolution + j ) ] = 0;
        bilinearFilterImageData.data[ 4 * ( i * bilinearResolution + j ) + 1 ] = 100;
        bilinearFilterImageData.data[ 4 * ( i * bilinearResolution + j ) + 2 ] = 100;
        bilinearFilterImageData.data[ 4 * ( i * bilinearResolution + j ) + 3 ] = 255 * Math.pow( value, 1 / 1.5 );

        const intersects = shape.containsPoint( v2( x + 0.5, y + 0.5 ) );
        const intersectedValue = intersects ? value : 0;
        bilinearFilterIntersectionImageData.data[ 4 * ( i * bilinearResolution + j ) ] = 255;
        bilinearFilterIntersectionImageData.data[ 4 * ( i * bilinearResolution + j ) + 1 ] = 0;
        bilinearFilterIntersectionImageData.data[ 4 * ( i * bilinearResolution + j ) + 2 ] = 0;
        bilinearFilterIntersectionImageData.data[ 4 * ( i * bilinearResolution + j ) + 3 ] = 255 * Math.pow( intersectedValue, 1 / 1.5 );
      }
    }
    const bilinearFilterCanvas = document.createElement( 'canvas' );
    bilinearFilterCanvas.width = bilinearResolution;
    bilinearFilterCanvas.height = bilinearResolution;
    bilinearFilterCanvas.getContext( '2d' ).putImageData( bilinearFilterImageData, 0, 0 );
    const bilinearFilterIntersectionCanvas = document.createElement( 'canvas' );
    bilinearFilterIntersectionCanvas.width = bilinearResolution;
    bilinearFilterIntersectionCanvas.height = bilinearResolution;
    bilinearFilterIntersectionCanvas.getContext( '2d' ).putImageData( bilinearFilterIntersectionImageData, 0, 0 );

    const cubicResolution = 512;
    const cubicFilterImageData = new ImageData( cubicResolution, cubicResolution );
    const cubicFilterIntersectionImageData = new ImageData( cubicResolution, cubicResolution );
    for ( let i = 0; i < cubicResolution; i++ ) {
      const y = 4 * ( i - ( cubicResolution - 1 ) / 2 ) / cubicResolution;
      for ( let j = 0; j < cubicResolution; j++ ) {
        const x = 4 * ( j - ( cubicResolution - 1 ) / 2 ) / cubicResolution;

        // within 1: (1/6)*((12 - 9*b - 6*c)*t^3 + (-18 + 12*b + 6*c)*t^2 + (6 - 2*b))
        // outside 1: (1/6)*((-b - 6*c)*t^3 + (6*b + 30*c)*t^2 + (-12*b - 48*c)*t + (8*b + 24*c))

        const absX = Math.abs( x );
        const absY = Math.abs( y );

        let value = 1;
        value *= absX < 1 ? ( 7 / 6 * absX * absX * absX - 2 * absX * absX + 8 / 9 ) : ( -7 / 18 * absX * absX * absX + 2 * absX * absX - 10 / 3 * absX + 16 / 9 );
        value *= absY < 1 ? ( 7 / 6 * absY * absY * absY - 2 * absY * absY + 8 / 9 ) : ( -7 / 18 * absY * absY * absY + 2 * absY * absY - 10 / 3 * absY + 16 / 9 );

        cubicFilterImageData.data[ 4 * ( i * cubicResolution + j ) ] = value > 0 ? 0 : 255;
        cubicFilterImageData.data[ 4 * ( i * cubicResolution + j ) + 1 ] = value > 0 ? 100 : 0;
        cubicFilterImageData.data[ 4 * ( i * cubicResolution + j ) + 2 ] = value > 0 ? 100 : 0;
        cubicFilterImageData.data[ 4 * ( i * cubicResolution + j ) + 3 ] = 255 * Math.pow( Math.abs( value ), 1 / 1.5 );

        const intersects = shape.containsPoint( v2( x + 0.5, y + 0.5 ) );
        const intersectedValue = intersects ? value : 0;
        cubicFilterIntersectionImageData.data[ 4 * ( i * cubicResolution + j ) ] = intersectedValue > 0 ? 255 : 0;
        cubicFilterIntersectionImageData.data[ 4 * ( i * cubicResolution + j ) + 1 ] = intersectedValue > 0 ? 0 : 255;
        cubicFilterIntersectionImageData.data[ 4 * ( i * cubicResolution + j ) + 2 ] = intersectedValue > 0 ? 0 : 255;
        cubicFilterIntersectionImageData.data[ 4 * ( i * cubicResolution + j ) + 3 ] = 255 * Math.pow( Math.abs( intersectedValue ), 1 / 1.5 );
      }
    }
    const cubicFilterCanvas = document.createElement( 'canvas' );
    cubicFilterCanvas.width = cubicResolution;
    cubicFilterCanvas.height = cubicResolution;
    cubicFilterCanvas.getContext( '2d' ).putImageData( cubicFilterImageData, 0, 0 );
    const cubicFilterIntersectionCanvas = document.createElement( 'canvas' );
    cubicFilterIntersectionCanvas.width = cubicResolution;
    cubicFilterIntersectionCanvas.height = cubicResolution;
    cubicFilterIntersectionCanvas.getContext( '2d' ).putImageData( cubicFilterIntersectionImageData, 0, 0 );

    const bilinearFilter3Node = new Node( {
      children: [
        new Path( createGridShape( -0.5, -0.5, 1.5, 1.5 ).transformed( matrix3 ), {
          stroke: 'black',
          lineWidth: 0.5
        } ),
        new Node( {
          matrix: matrix3,
          children: [
            new Node( {
              x: 0.5,
              y: 0.5,
              scale: 2 / bilinearResolution,
              children: [
                new Image( bilinearFilterCanvas, {
                  x: -bilinearResolution / 2,
                  y: -bilinearResolution / 2
                } )
              ]
            } )
          ]
        } )
      ]
    } );

    const bilinearFilterIntersection3Node = new Node( {
      children: [
        new Path( createGridShape( -0.5, -0.5, 1.5, 1.5 ).transformed( matrix3 ), {
          stroke: 'black',
          lineWidth: 0.5,
          opacity: 0.3
        } ),
        new Node( {
          matrix: matrix3,
          children: [
            new Node( {
              x: 0.5,
              y: 0.5,
              scale: 2 / bilinearResolution,
              children: [
                new Image( bilinearFilterIntersectionCanvas, {
                  x: -bilinearResolution / 2,
                  y: -bilinearResolution / 2
                } )
              ]
            } )
          ]
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, -0.5, 0.5, 0.5 ) ) ).transformed( matrix3 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, -0.5, 1.5, 0.5 ) ) ).transformed( matrix3 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, 0.5, 0.5, 1.5 ) ) ).transformed( matrix3 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) ) ).transformed( matrix3 ), {
          stroke: 'black'
        } )
      ]
    } );

    const cubicFilter5Node = new Node( {
      children: [
        new Path( createGridShape( -1.5, -1.5, 2.5, 2.5 ).transformed( matrix5 ), {
          stroke: 'black',
          lineWidth: 0.5
        } ),
        new Node( {
          matrix: matrix5,
          children: [
            new Node( {
              x: 0.5,
              y: 0.5,
              scale: 4 / cubicResolution,
              children: [
                new Image( cubicFilterCanvas, {
                  x: -cubicResolution / 2,
                  y: -cubicResolution / 2
                } )
              ]
            } )
          ]
        } )
      ]
    } );

    const cubicFilterIntersection5Node = new Node( {
      children: [
        new Path( createGridShape( -1.5, -1.5, 2.5, 2.5 ).transformed( matrix5 ), {
          stroke: 'black',
          lineWidth: 0.5,
          opacity: 0.3
        } ),
        new Node( {
          matrix: matrix5,
          children: [
            new Node( {
              x: 0.5,
              y: 0.5,
              scale: 4 / cubicResolution,
              children: [
                new Image( cubicFilterIntersectionCanvas, {
                  x: -cubicResolution / 2,
                  y: -cubicResolution / 2
                } )
              ]
            } )
          ]
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -1.5, -1.5, -0.5, -0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, -1.5, 0.5, -0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, -1.5, 1.5, -0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 1.5, -1.5, 2.5, -0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -1.5, -0.5, -0.5, 0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, -0.5, 0.5, 0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, -0.5, 1.5, 0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 1.5, -0.5, 2.5, 0.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -1.5, 0.5, -0.5, 1.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, 0.5, 0.5, 1.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 1.5, 0.5, 2.5, 1.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -1.5, 1.5, -0.5, 2.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( -0.5, 1.5, 0.5, 2.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 0.5, 1.5, 1.5, 2.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } ),
        new Path( shape.shapeIntersection( Shape.bounds( new Bounds2( 1.5, 1.5, 2.5, 2.5 ) ) ).transformed( matrix5 ), {
          stroke: 'black'
        } )
      ]
    } );

    const pixelsLabelNode = new Text( 'Pixel Grid', {
      font: '10px sans-serif',
      right: size - 5,
      top: 3,
      fill: '#666'
    } );

    const boxFilterLabel = new Text( 'Box Filter', {
      font: '12px sans-serif',
      centerX: size / 2,
      bottom: size - 5,
      fill: '#333'
    } );

    const bilinearFilterLabel = new Text( 'Bilinear Filter', {
      font: '12px sans-serif',
      centerX: size / 2,
      bottom: size - 5,
      fill: '#333'
    } );

    const cubicFilterLabel = new Text( 'Mitchell-Netravali Filter', {
      font: '12px sans-serif',
      centerX: size / 2,
      bottom: size - 5,
      fill: '#333'
    } );

    const contributionLabel = new Text( 'Contribution (product of both)', {
      font: '12px sans-serif',
      centerX: size / 2,
      bottom: size - 5,
      fill: '#333'
    } );

    const polygonLabel = new Text( 'Input Polygon', {
      font: '12px sans-serif',
      centerX: size / 2,
      bottom: size - 5,
      fill: '#333'
    } );

    return {
      samples3Node: samples3Node,
      fill3Node: fill3Node,
      grid3Node: grid3Node,
      pixelsLabelNode: pixelsLabelNode,
      polygonLabel: polygonLabel,
      boxFilter3Node: boxFilter3Node,
      boxFilterLabel: boxFilterLabel,
      stroke3Node: stroke3Node,
      boxFilterIntersection3Node: boxFilterIntersection3Node,
      contributionLabel: contributionLabel,
      bilinearFilter3Node: bilinearFilter3Node,
      bilinearFilterLabel: bilinearFilterLabel,
      bilinearFilterIntersection3Node: bilinearFilterIntersection3Node,
      samples5Node: samples5Node,
      fill5Node: fill5Node,
      grid5Node: grid5Node,
      cubicFilter5Node: cubicFilter5Node,
      cubicFilterLabel: cubicFilterLabel,
      stroke5Node: stroke5Node,
      cubicFilterIntersection5Node: cubicFilterIntersection5Node
    };
  };

  // Lazily create this, since it is slow
  let createdNodes = null;
  const getLazyNodes = () => {
    if ( !createdNodes ) {
      createdNodes = createNodes();
    }
    return createdNodes;
  };

  window.addDiagram( 'box-diagram', () => {
    const nodes = getLazyNodes();

    return window.createSceneryDiagram(
      new Node( {
        children: [
          new Node( {
            children: [
              nodes.samples3Node,
              nodes.fill3Node,
              nodes.grid3Node,
              nodes.pixelsLabelNode,
              nodes.polygonLabel
            ]
          } ),
          new Node( {
            x: size,
            children: [
              nodes.grid3Node,
              nodes.boxFilter3Node,
              nodes.pixelsLabelNode,
              nodes.boxFilterLabel
            ]
          } ),
          new Node( {
            x: 2 * size,
            children: [
              nodes.grid3Node,
              nodes.stroke3Node,
              nodes.boxFilterIntersection3Node,
              nodes.pixelsLabelNode,
              nodes.contributionLabel
            ]
          } )
        ]
      } ),
      3 * size, size, true
    );
  } );

  window.addDiagram( 'bilinear-diagram', () => {
    const nodes = getLazyNodes();

    return window.createSceneryDiagram(
      new Node( {
        children: [
          new Node( {
            children: [
              nodes.samples3Node,
              nodes.fill3Node,
              nodes.grid3Node,
              nodes.pixelsLabelNode,
              nodes.polygonLabel
            ]
          } ),
          new Node( {
            x: size,
            children: [
              nodes.grid3Node,
              nodes.bilinearFilter3Node,
              nodes.pixelsLabelNode,
              nodes.bilinearFilterLabel
            ]
          } ),
          new Node( {
            x: 2 * size,
            children: [
              nodes.grid3Node,
              nodes.stroke3Node,
              nodes.bilinearFilterIntersection3Node,
              nodes.pixelsLabelNode,
              nodes.contributionLabel
            ]
          } )
        ]
      } ),
      3 * size, size, true
    );
  } );

  window.addDiagram( 'mitchell-netravali-diagram', () => {
    const nodes = getLazyNodes();

    return window.createSceneryDiagram(
      new Node( {
        children: [
          new Node( {
            children: [
              nodes.samples5Node,
              nodes.fill5Node,
              nodes.grid5Node,
              nodes.pixelsLabelNode,
              nodes.polygonLabel
            ]
          } ),
          new Node( {
            x: size,
            children: [
              nodes.grid5Node,
              nodes.cubicFilter5Node,
              nodes.pixelsLabelNode,
              nodes.cubicFilterLabel
            ]
          } ),
          new Node( {
            x: 2 * size,
            children: [
              nodes.grid5Node,
              nodes.stroke5Node,
              nodes.cubicFilterIntersection5Node,
              nodes.pixelsLabelNode,
              nodes.contributionLabel
            ]
          } )
        ]
      } ),
      3 * size, size, true
    );
  } );
}

{
  const getSiemensStar = ( type, pointCount ) => {
    const width = 128;
    const height = 128;

    const center = v2( width / 2 + 0.15992094, height / 2 + 0.426296 );
    const radius = width * 0.49;

    const polygon = [];
    for ( let i = 0; i < pointCount; i++ ) {
      const angle0 = i * 2 * Math.PI / pointCount;
      const angle1 = ( i + 0.5 ) * 2 * Math.PI / pointCount;

      const p0 = v2( center.x + radius * Math.cos( angle0 ), center.y + radius * Math.sin( angle0 ) );
      const p1 = v2( center.x + radius * Math.cos( angle1 ), center.y + radius * Math.sin( angle1 ) );

      polygon.push( center );
      polygon.push( p0 );
      polygon.push( p1 );
    }

    if ( type === 'svg' || type === 'canvas' || type === 'vello' ) {
      return window.getSceneryElement(
        new Path( Shape.polygon( polygon ), { fill: 'black', renderer: type } ),
        width, height, 'white', type
      );
    }
    else if ( type === 'box' || type === 'bilinear' || type === 'mitchellNetravali' ) {
      const filtering = {
        box: PolygonFilterType.Box,
        bilinear: PolygonFilterType.Bilinear,
        mitchellNetravali: PolygonFilterType.MitchellNetravali
      }[ type ];

      const program = new RenderPathBoolean(
        new RenderPath( 'nonzero', [ polygon ] ),
        RenderFromNode.colorFrom( 'black' ),
        RenderFromNode.colorFrom( 'white' )
      );

      return window.getRasterizedElement( program, width, height, {
        polygonFiltering: filtering
      } );
    }
    else {
      throw new Error( 'unknown type' );
    }
  };

  const getFiltered = ( filter, multiplier ) => {
    const width = 150;
    const height = 150;

    const program = new RenderStack( [
      new RenderPathBoolean(
        new RenderPath( 'nonzero', [ [
          phet.dot.v2( 30, 30 ),
          phet.dot.v2( 120, 30 ),
          phet.dot.v2( 120, 120 ),
          phet.dot.v2( 30, 120 )
        ], [
          phet.dot.v2( 35, 35 ),
          phet.dot.v2( 45, 105 ),
          phet.dot.v2( 90, 90 ),
          phet.dot.v2( 105, 35 )
        ] ] ),
        RenderFromNode.colorFrom( 'black' ),
        RenderFromNode.colorFrom( 'white' )
      ),
      new RenderPathBoolean(
        new RenderPath( 'nonzero', [
          ...window.shapeToPolygons( Shape.regularPolygon( 20, 5 ).transformed( Matrix3.translation( 100, 100 ) ) )
        ] ),
        RenderFromNode.colorFrom( 'red' ),
        RenderColor.TRANSPARENT
      ),
      new RenderPathBoolean(
        new RenderPath( 'nonzero', [ [
          phet.dot.v2( 50, 50 ),
          phet.dot.v2( 45, 105 ),
          phet.dot.v2( 90, 90 )
        ] ] ),
        RenderFromNode.colorFrom( 'blue' ),
        RenderColor.TRANSPARENT
      )
    ] );

    return window.getRasterizedElement( program, width, height, {
      polygonFiltering: filter,
      polygonFilterWindowMultiplier: multiplier * window.devicePixelRatio
    } );
  };

  window.addDiagram( 'siemens-canvas', () => getSiemensStar( 'canvas', 200 ) );
  window.addDiagram( 'siemens-svg', () => getSiemensStar( 'svg', 200 ) );
  window.addDiagram( 'siemens-box', () => getSiemensStar( 'box', 200 ) );
  window.addDiagram( 'siemens-bilinear', () => getSiemensStar( 'bilinear', 200 ) );
  window.addDiagram( 'siemens-mitchell-netravali', () => getSiemensStar( 'mitchellNetravali', 200 ) );

  window.addDiagram( 'blur-reference', () => getFiltered( PolygonFilterType.Box, 1 ) );
  window.addDiagram( 'blur-box', () => getFiltered( PolygonFilterType.Box, 10 ) );
  window.addDiagram( 'blur-bilinear', () => getFiltered( PolygonFilterType.Bilinear, 10 ) );
  window.addDiagram( 'blur-mitchell-netravali', () => getFiltered( PolygonFilterType.MitchellNetravali, 10 ) );
}

{
  window.createRenderProgramSandbox( 'RenderColor-example', () => {
    /*START*/
    const program = new RenderColor( new Vector4( 1, 0, 0, 1 ) );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderPathBoolean-example', () => {
    /*START*/
    const program = new RenderPathBoolean(
      // The path. We have a "fill rule" of nonzero, which defines which sections
      // are considered inside. See https://en.wikipedia.org/wiki/Nonzero-rule
      new RenderPath( 'nonzero', [ [
        v2( 20, 20 ),
        v2( 90, 40 ),
        v2( 118, 118 ),
        v2( 50, 80 )
      ] ] ),

      // The "inside" RenderProgram
      new RenderColor( new Vector4( 1, 0, 0, 1 ) ),

      // The "outside" RenderProgram
      new RenderColor( new Vector4( 0.8, 0.8, 0.8, 1 ) )
    );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderStack-example', () => {
    /*START*/
    const program = new RenderStack( [
      // A constant background color
      new RenderColor( new Vector4( 0, 0, 0, 1 ) ),

      // Red diamond
      RenderPathBoolean.fromInside( // applies "transparent" to the "outside"
        new RenderPath( 'nonzero', [ [
          v2( 20, 20 ), v2( 90, 40 ), v2( 118, 118 ), v2( 50, 80 )
        ] ] ),
        new RenderColor( new Vector4( 1, 0, 0, 1 ) )
      ),

      // Green triangle
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', [ [
          v2( 10, 10 ), v2( 90, 10 ), v2( 10, 90 )
        ] ] ),
        new RenderColor( new Vector4( 0, 1, 0, 1 ) )
      ),

      // Semi-transparent white rectangle
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', [ [
          v2( 30, 30 ), v2( 110, 30 ), v2( 110, 80 ), v2( 30, 80 )
        ] ] ),
        new RenderColor( new Vector4( 0.7, 0.7, 0.7, 0.7 ) )
      )
    ] );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderLinearBlend-example', () => {
    /*START*/
    const program = new RenderLinearBlend(
      new Vector2( 1 / 128, 0 ), // scaledNormal
      0, // offset
      RenderLinearBlendAccuracy.Accurate,

      // "zero" RenderProgram
      new RenderColor( new Vector4( 1, 0, 0, 1 ) ),

      // "one" RenderProgram
      new RenderColor( new Vector4( 0, 0, 1, 1 ) )
    );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderLinearGradient-example', () => {
    /*START*/
    const program = new RenderLinearGradient(
      Matrix3.IDENTITY, // transform
      new Vector2( 0, 0 ), // start
      new Vector2( 50, 20 ), // end
      [
        new RenderGradientStop( 0, new RenderColor( new Vector4( 0, 0, 0, 1 ) ) ),
        new RenderGradientStop( 0.5, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
        new RenderGradientStop( 1, new RenderColor( new Vector4( 1, 1, 1, 1 ) ) )
      ],
      RenderExtend.Repeat, // Pad, Repeat, Reflect
      RenderLinearGradientAccuracy.SplitAccurate
    );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderRadialBlend-example', () => {
    /*START*/
    const program = new RenderRadialBlend(
      Matrix3.translation( 64, 64 ), // transform
      0, // radius0,
      64, // radius1
      RenderRadialBlendAccuracy.Accurate,

      // "zero" RenderProgram
      new RenderColor( new Vector4( 1, 0, 0, 1 ) ),

      // "one" RenderProgram
      new RenderColor( new Vector4( 0, 0, 1, 1 ) )
    );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderRadialGradient-example', () => {
    /*START*/
    const program = new RenderRadialGradient(
      Matrix3.IDENTITY, // transform
      new Vector2( 0, 0 ), // start
      0, // startRadius
      new Vector2( 0, 0 ), // end
      64, // endRadius
      [
        new RenderGradientStop( 0, new RenderColor( new Vector4( 0, 0, 0, 1 ) ) ),
        new RenderGradientStop( 0.5, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
        new RenderGradientStop( 1, new RenderColor( new Vector4( 1, 1, 1, 1 ) ) )
      ],
      RenderExtend.Repeat, // Pad, Repeat, Reflect
      RenderRadialGradientAccuracy.SplitAccurate
    );
    /*END*/
    return program;
  }, 128, 128 );
}

{
  window.createRenderProgramSandbox( 'RenderBlendCompose-example', () => {
    const size = 90;
    const padding = 5;
    const n0 = padding;
    const n1 = ( size - 2 * padding ) / 3 + padding;
    const n2 = 2 * ( size - 2 * padding ) / 3 + padding;
    const n3 = 3 * ( size - 2 * padding ) / 3 + padding;
    /*START*/
    const exampleCompositeModes = [
      // There are a few more modes, for other compositing situations
      RenderComposeType.Over,
      RenderComposeType.In,
      RenderComposeType.Out,
      RenderComposeType.Atop,
      RenderComposeType.Xor
    ];
    const program = new RenderStack(
      exampleCompositeModes.map( ( composeMode, i ) => {
        const x = i * size;
        return new RenderBlendCompose(
          composeMode,
          RenderBlendType.Normal,
          RenderPathBoolean.fromInside(
            RenderPath.fromBounds( new Bounds2( x + n0, n0, x + n2, n2 ) ),
            new RenderColor( new Vector4( 1, 0, 0, 1 ) )
          ),
          RenderPathBoolean.fromInside(
            RenderPath.fromBounds( new Bounds2( x + n1, n1, x + n3, n3 ) ),
            new RenderColor( new Vector4( 0, 0.8, 0, 1 ) )
          )
        );
      } )
    );
    /*END*/
    return program;
  }, 5 * 90, 90 );
}

{
  window.createRenderProgramSandbox( 'execution-instructions-example', () => {
    /*START*/
    const program = new RenderLinearGradient(
      Matrix3.IDENTITY, // transform
      new Vector2( 0, 0 ), // start
      new Vector2( 50, 20 ), // end
      [
        new RenderGradientStop( 0, new RenderColor( new Vector4( 0, 0, 0, 1 ) ) ),
        new RenderGradientStop( 0.5, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
        new RenderGradientStop( 1, new RenderColor( new Vector4( 1, 1, 1, 1 ) ) )
      ],
      RenderExtend.Repeat, // Pad, Repeat, Reflect
      RenderLinearGradientAccuracy.SplitAccurate
    );
    /*END*/
    return program;
  }, 128, 128, {
    showInstructions: true
  } );
}

{
  const getTeapot = ( shadeType, normalType ) => {
    const width = 200;
    const height = 200;

    const dl = 150;
    const projectionMatrix = RenderDepthSort.getProjectionMatrix( 1, 100, -1, -1, 1, 1 );
    const rotationMatrix = Matrix3.rotationY( 0 ).timesMatrix( Matrix3.rotationX( -0.5 ) );
    const project = p => {

      // a rotation, for testing
      p = rotationMatrix.timesVector3( p.minus( v3( 0, 0, dl ) ) ).plus( v3( 0, 0, dl ) );

      const clip = projectionMatrix.timesVector4( v4( p.x, p.y, p.z, 1 ) );
      return v3( clip.x / clip.w, -clip.y / clip.w, clip.z / clip.w );
    };

    const createTriangularMesh = ( mesh, matrix4 ) => {
      return mesh.faces.map( face => {
        const vertices = face.vertexIndices.map( i => mesh.vertices[ i ] ).reverse();
        const normals = face.normalIndices.map( i => mesh.normals[ i ] ).reverse();

        const transformedVertices = vertices.map( v => matrix4.timesVector3( v ) );
        const projectedVertices = transformedVertices.map( project );

        if ( projectedVertices[ 0 ].equals( projectedVertices[ 1 ] ) || projectedVertices[ 0 ].equals( projectedVertices[ 2 ] ) || projectedVertices[ 1 ].equals( projectedVertices[ 2 ] ) ) {
          return null;
        }

        const positionProgram = new RenderBarycentricPerspectiveBlend(
          projectedVertices[ 0 ], projectedVertices[ 1 ], projectedVertices[ 2 ],
          RenderBarycentricPerspectiveBlendAccuracy.Centroid,
          new RenderColor( transformedVertices[ 0 ].toVector4Zero() ),
          new RenderColor( transformedVertices[ 1 ].toVector4Zero() ),
          new RenderColor( transformedVertices[ 2 ].toVector4Zero() )
        );

        let normalProgram;
        if ( normalType === 'interpolated' ) {
          normalProgram = new RenderNormalize( new RenderBarycentricPerspectiveBlend(
            projectedVertices[ 0 ], projectedVertices[ 1 ], projectedVertices[ 2 ],
            RenderBarycentricPerspectiveBlendAccuracy.Centroid,
            new RenderColor( normals[ 0 ].toVector4Zero() ),
            new RenderColor( normals[ 1 ].toVector4Zero() ),
            new RenderColor( normals[ 2 ].toVector4Zero() )
          ) );
        }
        else if ( normalType === 'flat' ) {
          normalProgram = new RenderColor( normals[ 0 ].plus( normals[ 1 ] ).plus( normals[ 2 ] ).normalized().toVector4Zero() );
        }

        // const positionProgram = new RenderColor( transformedVertices[ 0 ].plus( transformedVertices[ 1 ] ).plus( transformedVertices[ 2 ] ).timesScalar( 1 / 3 ).toVector4() );

        let renderProgram;
        if ( shadeType === 'phong' ) {
          const ambientColorProgram = new RenderColor( v4( 0, 0, 0, 1 ) );
          const diffuseColorProgram = new RenderColor( v4( 1, 0.05, 0, 1 ) );
          const specularColorProgram = new RenderColor( v4( 0.5, 0.5, 0.5, 1 ) );
          renderProgram = new RenderPhong( 50, ambientColorProgram, diffuseColorProgram, specularColorProgram, positionProgram, normalProgram, [
            new RenderLight(
              new RenderColor( v4( -2.0, 3.5, -2.0, 0 ).normalized() ),
              new RenderColor( v4( 1, 1, 1, 1 ) )
            )
          ] );
        }
        else if ( shadeType === 'normals' ) {
          renderProgram = new RenderNormalDebug( normalProgram );
        }
        else if ( shadeType === 'random' ) {
          // eslint-disable-next-line bad-sim-text
          renderProgram = new RenderColor( v4( Math.random(), Math.random(), Math.random(), 1 ) );
        }

        return new RenderPlanar(
          RenderPathBoolean.fromInside( new RenderPath( 'nonzero', [ [
            projectedVertices[ 0 ].toVector2(), projectedVertices[ 1 ].toVector2(), projectedVertices[ 2 ].toVector2()
          ] ] ), renderProgram ),
          projectedVertices[ 0 ], projectedVertices[ 1 ], projectedVertices[ 2 ]
        );
      } ).filter( _.identity );
    };

    let program = new RenderDepthSort( [
      // eslint-disable-next-line no-undef
      ...createTriangularMesh( Mesh.loadOBJ( teapotOBJ )[ 0 ], Matrix4.translation( 0, 0, 150 ) )
    ] ).transformed( phet.dot.Matrix3.scaling( 170 * width / 256 ) ).transformed( phet.dot.Matrix3.translation( width / 2, height / 2 ) );
    if ( shadeType === 'phong' ) {
      program = new RenderLinearSRGBToSRGB( program );
    }

    return window.getRasterizedElement( program, width, height );
  };

  window.addDiagram( 'teapot-faces', () => getTeapot( 'random', 'flat' ) );
  window.addDiagram( 'teapot-normals', () => getTeapot( 'normals', 'interpolated' ) );
  window.addDiagram( 'teapot-phong', () => getTeapot( 'phong', 'interpolated' ) );
}

{
  const getTransparentSpheres = () => {
    const width = 128;
    const height = 128;

    const dl = 60;
    const projectionMatrix = RenderDepthSort.getProjectionMatrix( 1, 100, -1, -1, 1, 1 );
    const rotationMatrix = Matrix3.rotationY( 0 ).timesMatrix( Matrix3.rotationX( -0.5 ) );
    const project = p => {

      // a rotation, for testing
      p = rotationMatrix.timesVector3( p.minus( v3( 0, 0, dl ) ) ).plus( v3( 0, 0, dl ) );

      const clip = projectionMatrix.timesVector4( v4( p.x, p.y, p.z, 1 ) );
      return v3( clip.x / clip.w, -clip.y / clip.w, clip.z / clip.w );
    };
    const createSphere = ( center, radius, thetaDivisions, phiDivisions, alpha, diffuseColor ) => {
      const planars = [];

      for ( let i = 0; i < thetaDivisions; i++ ) {
        const theta0 = i / thetaDivisions * 2 * Math.PI;
        const theta1 = ( i + 1 ) / thetaDivisions * 2 * Math.PI;

        for ( let j = 0; j < phiDivisions; j++ ) {
          const phi0 = j / phiDivisions * Math.PI;
          const phi1 = ( j + 1 ) / phiDivisions * Math.PI;

          const p00 = v3(
            Math.sin( phi0 ) * Math.cos( theta0 ),
            Math.sin( phi0 ) * Math.sin( theta0 ),
            Math.cos( phi0 )
          );
          const p01 = v3(
            Math.sin( phi0 ) * Math.cos( theta1 ),
            Math.sin( phi0 ) * Math.sin( theta1 ),
            Math.cos( phi0 )
          );
          const p10 = v3(
            Math.sin( phi1 ) * Math.cos( theta0 ),
            Math.sin( phi1 ) * Math.sin( theta0 ),
            Math.cos( phi1 )
          );
          const p11 = v3(
            Math.sin( phi1 ) * Math.cos( theta1 ),
            Math.sin( phi1 ) * Math.sin( theta1 ),
            Math.cos( phi1 )
          );

          const tri = ( p0, p1, p2 ) => {

            const point0 = center.plus( p0.timesScalar( radius ) );
            const point1 = center.plus( p1.timesScalar( radius ) );
            const point2 = center.plus( p2.timesScalar( radius ) );

            const projected0 = project( point0 );
            const projected1 = project( point1 );
            const projected2 = project( point2 );

            const positionProgram = new RenderBarycentricPerspectiveBlend(
              projected0, projected1, projected2,
              RenderBarycentricPerspectiveBlendAccuracy.Centroid,
              new RenderColor( point0.toVector4Zero() ),
              new RenderColor( point1.toVector4Zero() ),
              new RenderColor( point2.toVector4Zero() )
            );
            const normalProgram = new RenderNormalize( new RenderBarycentricPerspectiveBlend(
              projected0, projected1, projected2,
              RenderBarycentricPerspectiveBlendAccuracy.Centroid,
              new RenderColor( p0.toVector4() ),
              new RenderColor( p1.toVector4() ),
              new RenderColor( p2.toVector4() )
            ) );

            const ambientColorProgram = new RenderColor( v4( 0, 0, 0, alpha ) );
            const diffuseColorProgram = new RenderColor( v4( diffuseColor.x, diffuseColor.y, diffuseColor.z, 0.01 ) );
            const specularColorProgram = new RenderColor( v4( 0.5, 0.5, 0.5, 0.01 ) );
            const program = new RenderPhong( 50, ambientColorProgram, diffuseColorProgram, specularColorProgram, positionProgram, normalProgram, [
              new RenderLight(
                new RenderColor( v4( -2.0, 3.5, -2.0, 0 ).normalized() ),
                new RenderColor( v4( 1, 1, 1, 1 ) )
              )
            ] );
            // const program = new RenderNormalDebug( normalProgram );

            return new RenderPlanar(
              RenderPathBoolean.fromInside( new RenderPath( 'nonzero', [ [
                projected0.toVector2(), projected1.toVector2(), projected2.toVector2()
              ] ] ), program ),
              projected0, projected1, projected2
            );
          };

          if ( !p00.equalsEpsilon( p01, 1e-6 ) && !p00.equalsEpsilon( p10, 1e-6 ) && !p01.equalsEpsilon( p10, 1e-6 ) ) {
            planars.push( tri( p00, p10, p01 ) );
          }
          if ( !p01.equalsEpsilon( p10, 1e-6 ) && !p01.equalsEpsilon( p11, 1e-6 ) && !p10.equalsEpsilon( p11, 1e-6 ) ) {
            planars.push( tri( p01, p10, p11 ) );
          }
        }
      }

      return planars;
    };

    const thetas = 16;
    const phis = 16;

    const program = new RenderLinearSRGBToSRGB( new RenderDepthSort( [
      ...createSphere( phet.dot.v3( 0, 0, dl ), 4, thetas, phis, 0.6, v3( 1, 0.05, 0 ) ),
      ...createSphere( phet.dot.v3( 2, 2, dl ), 4, thetas, phis, 1, v3( 0, 0.05, 1 ) ),
      ...createSphere( phet.dot.v3( 0, 4, dl ), 4, thetas, phis, 0.8, v3( 0, 1, 0.05 ) ),
      ...createSphere( phet.dot.v3( 4, 4, dl ), 4, thetas, phis, 0.4, v3( 0.8, 0.8, 0.8 ) )
    ] ) ).transformed( Matrix3.scaling( 4 * width ) ).transformed( Matrix3.translation( width / 2 - width / 8, height / 2 + height / 8 ) );

    return window.getRasterizedElement( program, width, height );
  };

  window.addDiagram( 'transparent-3d', () => getTransparentSpheres() );
}

{
  window.deviceContextPromise.then( async deviceContext => {
    if ( !showDiagrams ) {
      return;
    }

    const outputSize = 256;
    const rasterSize = Math.ceil( outputSize * window.devicePixelRatio );

    const clippableFace = TestToCanvas.getTestPath();

    const mainFace = clippableFace.getTransformed( phet.dot.Matrix3.scaling( 0.37 ) );
    const smallerFace = clippableFace.getTransformed( phet.dot.Matrix3.translation( 16, 165 ).timesMatrix( phet.dot.Matrix3.scaling( 0.15 ) ) );

    const clientSpace = RenderColorSpace.premultipliedLinearSRGB;

    const program = new RenderStack( [
      new RenderPathBoolean(
        RenderPath.fromBounds( new phet.dot.Bounds2( 0, 0, 128, 256 ) ),
        new RenderColor(
          new phet.dot.Vector4( 0, 0, 0, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace ),
        new RenderColor(
          new phet.dot.Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', smallerFace.toPolygonalFace().polygons ),
        new RenderColor(
          new phet.dot.Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', mainFace.toPolygonalFace().polygons ),
        new RenderLinearBlend(
          new phet.dot.Vector2( 1 / 256, 0 ),
          0,
          RenderLinearBlendAccuracy.Accurate,
          new RenderColor( new phet.dot.Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab ),
          new RenderColor( new phet.dot.Vector4( 0.5, 0, 1, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab )
        ).colorConverted( RenderColorSpace.premultipliedOklab, clientSpace )
      )
    ] ).transformed( phet.dot.Matrix3.scaling( rasterSize / 256 ) );

    if ( deviceContext ) {
      document.getElementById( 'rasterize-initial-demo-container' ).style.display = 'block';

      const createCanvas = async numStages => {
        const canvas = document.createElement( 'canvas' );
        canvas.width = rasterSize;
        canvas.height = rasterSize;
        canvas.style.width = `${outputSize}px`;
        canvas.style.height = `${outputSize}px`;
        canvas.style.margin = '0 20px';
        // canvas.style.imageRendering = 'pixelated';

        const context = deviceContext.getCanvasContext( canvas, 'srgb' );

        await Rasterize.hybridRasterize( program, deviceContext, context, new phet.dot.Bounds2( 0, 0, rasterSize, rasterSize ), 'srgb', {
          rasterClipperOptions: {
            numStages: numStages,
            bufferExponent: 15 // We can get away with 14 on double-pixels, but...
          }
        } );

        return canvas;
      };

      // remove all children
      const demoElement = document.getElementById( 'rasterize-initial-demo' );
      while ( demoElement.firstChild ) {
        demoElement.removeChild( demoElement.firstChild );
      }

      demoElement.appendChild( await createCanvas( 16 ) );

      demoElement.appendChild( document.createElement( 'br' ) );

      const transparencyDemoContainer = document.createElement( 'div' );
      transparencyDemoContainer.style.margin = '10px 20px';
      transparencyDemoContainer.style.display = 'inline-block';
      transparencyDemoContainer.style.position = 'relative';
      transparencyDemoContainer.style.width = `${outputSize}px`;
      transparencyDemoContainer.style.height = `${outputSize}px`;
      demoElement.appendChild( transparencyDemoContainer );
      for ( let i = 16; i > 0; i-- ) {
        const canvas = await createCanvas( i );
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.opacity = '10%';
        transparencyDemoContainer.appendChild( canvas );
      }

      const brightnessDemoContainer = document.createElement( 'div' );
      brightnessDemoContainer.style.margin = '10px 20px';
      brightnessDemoContainer.style.display = 'inline-block';
      brightnessDemoContainer.style.position = 'relative';
      brightnessDemoContainer.style.width = `${outputSize}px`;
      brightnessDemoContainer.style.height = `${outputSize}px`;
      demoElement.appendChild( brightnessDemoContainer );
      for ( let i = 16; i > 0; i-- ) {
        const canvas = await createCanvas( i );
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.filter = `contrast(0) brightness(${i * 10}%)`;
        brightnessDemoContainer.appendChild( canvas );
      }
    }
  } );
}