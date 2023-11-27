// Copyright 2023, University of Colorado Boulder

/**
 * Testing for rasterization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BlitShader, ComputeShader, DeviceContext, PolygonalFace, wgsl_test_to_canvas } from '../imports.js';
import Matrix3 from '../../../dot/js/Matrix3.js';

export default class TestToCanvas {

  // phet.alpenglow.TestToCanvas.render().then( c => document.body.appendChild( c ) )
  public static async render(): Promise<HTMLCanvasElement> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const displaySize = 512;

    const deviceContext = new DeviceContext( device );
    const canvas = document.createElement( 'canvas' );
    canvas.width = displaySize * window.devicePixelRatio;
    canvas.height = displaySize * window.devicePixelRatio;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const context = deviceContext.getCanvasContext( canvas, 'srgb' );

    const outTexture = context.getCurrentTexture();

    const pathEdges = TestToCanvas.getTestPath().toEdgedFace().edges;
    const pointsWithMatrix = ( matrix: Matrix3 ): number[] => {
      return pathEdges.flatMap( edge => {
        // NOTE: reversed here, due to our test path!!!
        const start = matrix.timesVector2( edge.endPoint );
        const end = matrix.timesVector2( edge.startPoint );

        return [ start.x, start.y, end.x, end.y ];
      } );
    };
    const pathPoints = [
      ...pointsWithMatrix( Matrix3.scaling( 1.5 ) ),
      ...pointsWithMatrix( Matrix3.translation( 150, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 300, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 450, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 600, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 750, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 900, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ..._.range( 0, 10 ).flatMap( i => {
        return _.range( 0, 4 ).flatMap( j => {
          return pointsWithMatrix( Matrix3.translation( 100 + 40 * i, 800 + 40 * j ).timesMatrix( Matrix3.scaling( 0.05 ) ) );
        } );
      } )
    ];
    console.log( `edge count: ${pathPoints.length / 4}` );

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    } );
    device.queue.writeBuffer( configBuffer, 0, new Uint32Array( [
      pathPoints.length / 4
    ] ).buffer );

    const dataBuffer = deviceContext.createBuffer( 4 * pathPoints.length );
    device.queue.writeBuffer( dataBuffer, 0, new Float32Array( pathPoints ).buffer );

    const shader = ComputeShader.fromSource( device, 'shader', wgsl_test_to_canvas, [
      BindingType.UNIFORM_BUFFER,
      deviceContext.preferredStorageFormat === 'bgra8unorm' ? BindingType.TEXTURE_OUTPUT_BGRA8UNORM : BindingType.TEXTURE_OUTPUT_RGBA8UNORM,
      BindingType.READ_ONLY_STORAGE_BUFFER
    ], {
      preferredStorageFormat: deviceContext.preferredStorageFormat
    } );
    const blitShader = new BlitShader( device, deviceContext.preferredCanvasFormat );

    const encoder = device.createCommandEncoder( {
      label: 'the encoder'
    } );

    const canvasTextureFormat = outTexture.format;
    if ( canvasTextureFormat !== 'bgra8unorm' && canvasTextureFormat !== 'rgba8unorm' ) {
      throw new Error( 'unsupported format' );
    }

    const canOutputToCanvas = canvasTextureFormat === deviceContext.preferredStorageFormat;
    let fineOutputTextureView: GPUTextureView;
    let fineOutputTexture: GPUTexture | null = null;
    const outTextureView = outTexture.createView();

    // TODO: factor out this pattern
    if ( canOutputToCanvas ) {
      fineOutputTextureView = outTextureView;
    }
    else {
      fineOutputTexture = device.createTexture( {
        label: 'fineOutputTexture',
        size: {
          width: outTexture.width,
          height: outTexture.height,
          depthOrArrayLayers: 1
        },
        format: deviceContext.preferredStorageFormat,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING // see TargetTexture
      } );
      fineOutputTextureView = fineOutputTexture.createView( {
        label: 'fineOutputTextureView',
        format: deviceContext.preferredStorageFormat,
        dimension: '2d'
      } );
    }

    assert && assert( Number.isInteger( canvas.width / 16 ) );
    assert && assert( Number.isInteger( canvas.height / 16 ) );

    // Have the fine-rasterization shader use the preferred format as output (for now)
    shader.dispatch( encoder, [
      configBuffer, fineOutputTextureView, dataBuffer
    ], canvas.width / 16, canvas.height / 16 );

    if ( !canOutputToCanvas ) {
      assert && assert( fineOutputTexture, 'If we cannot output to the Canvas directly, we will have created a texture' );

      blitShader.dispatch( encoder, outTextureView, fineOutputTextureView );
    }

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    const startTime = Date.now();

    device.queue.onSubmittedWorkDone().then( () => {
      const endTime = Date.now();

      console.log( endTime - startTime );
    } ).catch( err => {
      throw err;
    } );

    configBuffer.destroy();
    fineOutputTexture && fineOutputTexture.destroy();

    // TODO: dispose the device context once we are all done?

    return canvas;
  }

  public static getTestPath(): PolygonalFace {
    return PolygonalFace.deserialize( JSON.parse( '{"polygons":[[{"x":340,"y":420},{"x":336.4552722930908,"y":419.95716361999513},{"x":332.9326568603515,"y":419.8293109130859},{"x":329.43309898376464,"y":419.6174265289307},{"x":325.95754394531247,"y":419.3224951171875},{"x":322.5069370269775,"y":418.94550132751476},{"x":319.0822235107421,"y":418.48742980957036},{"x":315.68434867858883,"y":417.9492652130127},{"x":312.3142578125,"y":417.33199218749996},{"x":308.97289619445803,"y":416.6365953826904},{"x":305.6612091064453,"y":415.8640594482422},{"x":302.38014183044436,"y":415.0153690338135},{"x":299.1306396484375,"y":414.0915087890625},{"x":295.9136478424072,"y":413.09346336364746},{"x":292.7301116943359,"y":412.02221740722655},{"x":289.580976486206,"y":410.878755569458},{"x":286.46718749999997,"y":409.6640625},{"x":283.38969001770016,"y":408.37912284851075},{"x":280.34942932128905,"y":407.02492126464847},{"x":277.347350692749,"y":405.6024423980713},{"x":274.38439941406244,"y":404.11267089843744},{"x":271.4615207672119,"y":402.5565914154053},{"x":268.57966003417965,"y":400.9351885986328},{"x":265.7397624969482,"y":399.2494470977783},{"x":262.94277343749997,"y":397.5003515625},{"x":260.1896381378174,"y":395.68888664245605},{"x":257.48130187988284,"y":393.81603698730464},{"x":254.8187099456787,"y":391.882787246704},{"x":252.2028076171875,"y":389.8901220703125},{"x":249.63454017639157,"y":387.8390261077881},{"x":247.11485290527344,"y":385.73048400878906},{"x":244.6446910858154,"y":383.5654804229737},{"x":242.225,"y":381.34499999999997},{"x":239.85672492980956,"y":379.07002738952644},{"x":237.54081115722653,"y":376.741547241211},{"x":235.27820396423337,"y":374.36054420471197},{"x":233.06984863281247,"y":371.9280029296875},{"x":230.91669044494628,"y":369.44490806579597},{"x":228.81967468261718,"y":366.91224426269537},{"x":226.77974662780764,"y":364.330996170044},{"x":224.79785156250003,"y":361.7021484375},{"x":222.87493476867672,"y":359.0266857147217},{"x":221.01194152832034,"y":356.3055926513672},{"x":219.20981712341307,"y":353.5398538970947},{"x":217.46950683593752,"y":350.7304541015625},{"x":215.79195594787598,"y":347.8783779144287},{"x":214.17810974121096,"y":344.98460998535154},{"x":212.6289134979248,"y":342.0501349639892},{"x":211.1453125,"y":339.0759375},{"x":209.72825202941897,"y":336.063002243042},{"x":208.37867736816406,"y":333.01231384277344},{"x":207.0975337982178,"y":329.92485694885255},{"x":205.8857666015625,"y":326.8016162109375},{"x":204.74432106018065,"y":323.6435762786865},{"x":203.6741424560547,"y":320.4517218017578},{"x":202.676176071167,"y":317.2270374298095},{"x":201.7513671875,"y":313.9705078125},{"x":200.90066108703613,"y":310.68311759948733},{"x":200.1250030517578,"y":307.3658514404297},{"x":199.42533836364743,"y":304.01969398498534},{"x":198.80261230468747,"y":300.6456298828125},{"x":198.25777015686032,"y":297.24464378356936},{"x":197.7917572021484,"y":293.817720336914},{"x":197.40551872253417,"y":290.3658441925049},{"x":197.1,"y":286.89},{"x":144.65,"y":246.355},{"x":92.2,"y":205.82},{"x":89.62759521484375,"y":209.07552734375},{"x":87.08294921875,"y":212.35531249999997},{"x":84.56803955078125,"y":215.66041015624998},{"x":82.08484375,"y":218.991875},{"x":79.63533935546874,"y":222.35076171875002},{"x":77.22150390625,"y":225.73812500000003},{"x":74.84531494140626,"y":229.15501953125},{"x":72.50875,"y":232.60250000000002},{"x":70.21378662109375,"y":236.08162109375},{"x":67.96240234375,"y":239.59343749999996},{"x":65.75657470703126,"y":243.13900390624994},{"x":63.59828125,"y":246.71937499999999},{"x":61.489499511718755,"y":250.33560546874997},{"x":59.43220703125,"y":253.98874999999998},{"x":57.428381347656256,"y":257.67986328125005},{"x":55.480000000000004,"y":261.40999999999997},{"x":54.67596367714076,"y":263.1231672908415},{"x":53.97347991908751,"y":264.88041887913425},{"x":53.37495277064072,"y":266.67574108627656},{"x":52.88243051556872,"y":268.5029899481301},{"x":52.49759866695683,"y":270.35591224093685},{"x":52.22177419903272,"y":272.22816688114483},{"x":52.05590104020802,"y":274.11334662590866},{"x":52.00054684276001,"y":276.005},{"x":52.05590104020802,"y":277.89665337409133},{"x":52.22177419903272,"y":279.7818331188551},{"x":52.49759866695683,"y":281.65408775906315},{"x":52.882430515568714,"y":283.5070100518699},{"x":53.37495277064071,"y":285.33425891372343},{"x":53.97347991908751,"y":287.12958112086574},{"x":54.67596367714076,"y":288.8868327091585},{"x":55.480000000000004,"y":290.6},{"x":58.06080154418946,"y":295.53463771820066},{"x":60.71857055664063,"y":300.4182931518555},{"x":63.45244735717773,"y":305.2501109695434},{"x":66.261572265625,"y":310.02923583984375},{"x":69.14508560180664,"y":314.7548124313355},{"x":72.10212768554689,"y":319.4259854125977},{"x":75.13183883666993,"y":324.0418994522095},{"x":78.23335937499999,"y":328.60169921875},{"x":81.40582962036132,"y":333.10452938079834},{"x":84.64838989257814,"y":337.5495346069336},{"x":87.9601805114746,"y":341.9358595657349},{"x":91.340341796875,"y":346.26264892578126},{"x":94.78801406860352,"y":350.52904735565187},{"x":98.30233764648438,"y":354.7341995239258},{"x":101.88245285034179,"y":358.8772500991821},{"x":105.52749999999999,"y":362.95734375000006},{"x":109.23661941528319,"y":366.9736251449585},{"x":113.0089514160156,"y":370.92523895263673},{"x":116.84363632202147,"y":374.81132984161377},{"x":120.73981445312499,"y":378.63104248046875},{"x":124.69662612915037,"y":382.3835215377807},{"x":128.71321166992186,"y":386.06791168212885},{"x":132.78871139526365,"y":389.6833575820923},{"x":136.92226562499997,"y":393.22900390625},{"x":141.11301467895507,"y":396.70399532318106},{"x":145.36009887695312,"y":400.1074765014649},{"x":149.66265853881836,"y":403.4385921096802},{"x":154.019833984375,"y":406.69648681640626},{"x":158.43076553344727,"y":409.88030529022217},{"x":162.89459350585938,"y":412.9891921997071},{"x":167.41045822143553,"y":416.02229221344},{"x":171.97750000000002,"y":418.97875},{"x":176.59485916137695,"y":421.8577102279663},{"x":181.2616760253906,"y":424.65831756591797},{"x":185.97709091186525,"y":427.37971668243404},{"x":190.74024414062498,"y":430.02105224609375},{"x":195.55027603149415,"y":432.5814689254761},{"x":200.40632690429683,"y":435.06011138916017},{"x":205.3075370788574,"y":437.4561243057251},{"x":210.25304687499997,"y":439.76865234375},{"x":215.2419966125488,"y":441.9968401718139},{"x":220.2735266113281,"y":444.13983245849613},{"x":225.3467771911621,"y":446.1967738723755},{"x":230.46088867187495,"y":448.16680908203125},{"x":235.615001373291,"y":450.0490827560425},{"x":240.80825561523434,"y":451.84273956298824},{"x":246.03979171752925,"y":453.54692417144776},{"x":251.30874999999997,"y":455.16078125},{"x":256.6142707824707,"y":456.6834554672241},{"x":261.95549438476553,"y":458.11409149169924},{"x":267.33156112670895,"y":459.45183399200437},{"x":272.741611328125,"y":460.6958276367187},{"x":278.18478530883783,"y":461.84521709442134},{"x":283.66022338867185,"y":462.8991470336914},{"x":289.1670658874512,"y":463.85676212310796},{"x":294.704453125,"y":464.71720703125},{"x":300.27152542114254,"y":465.4796264266968},{"x":305.8674230957031,"y":466.14316497802736},{"x":311.49128646850585,"y":466.7069673538208},{"x":317.142255859375,"y":467.17017822265626},{"x":322.8194715881348,"y":467.53194225311285},{"x":328.5220739746094,"y":467.79140411376954},{"x":334.24920333862303,"y":467.9477084732056},{"x":340,"y":468},{"x":345.0344946289062,"y":467.9535009765625},{"x":350.04673828125004,"y":467.8155078125},{"x":355.0367456054688,"y":467.5882763671875},{"x":360.00453125,"y":467.2740625},{"x":364.9501098632813,"y":466.87512207031256},{"x":369.87349609375,"y":466.39371093750003},{"x":374.7747045898438,"y":465.83208496093755},{"x":379.65375,"y":465.1925},{"x":384.5106469726562,"y":464.47721191406254},{"x":389.34541015625,"y":463.6884765625},{"x":394.1580541992187,"y":462.82854980468755},{"x":398.94859374999993,"y":461.89968749999997},{"x":403.71704345703125,"y":460.90414550781253},{"x":408.46341796875,"y":459.84417968749995},{"x":413.18773193359374,"y":458.7220458984375},{"x":417.89,"y":457.54},{"x":391.945,"y":437.46500000000003},{"x":366.00000000000006,"y":417.39},{"x":362.7817833913764,"y":417.9738784680733},{"x":359.55114628528406,"y":418.48458003869973},{"x":356.30975238236977,"y":418.921841712816},{"x":353.05927092277255,"y":419.2854383111443},{"x":349.8013758265054,"y":419.57518259015467},{"x":346.53774483142627,"y":419.79092533849087},{"x":343.2700586292436,"y":419.93255545381044}],[],[{"x":653.8199999999999,"y":478.1},{"x":598.545,"y":435.38},{"x":543.27,"y":392.66},{"x":546.391509482518,"y":389.99611061704934},{"x":549.4797786155692,"y":387.2937557447408},{"x":552.5343334314416,"y":384.55335012314424},{"x":555.5547051366799,"y":381.77531433211436},{"x":558.540430184033,"y":378.9600747267424},{"x":561.4910503435965,"y":376.10806337192196},{"x":564.4061127731386,"y":373.21971797603896},{"x":567.2851700875998,"y":370.29548182379426},{"x":570.1277804277539,"y":367.3358037081717},{"x":572.9335075280228,"y":364.3411378615598},{"x":575.7019207834309,"y":361.31194388603956},{"x":578.4325953156917,"y":358.2486866828474},{"x":581.125112038416,"y":355.1518363810251},{"x":583.7790577214296,"y":352.02186826526724},{"x":586.3940250541942,"y":348.85926270297836},{"x":588.9696127083182,"y":345.6645050705481},{"x":591.50542539915,"y":342.43808567885975},{"x":594.0010739464442,"y":339.18049969803974},{"x":596.4561753340901,"y":335.89224708146253},{"x":598.8703527688943,"y":332.5738324890211},{"x":601.2432357384096,"y":329.2257652096744},{"x":603.5744600677972,"y":325.84855908328564},{"x":605.8636679757196,"y":322.442732421761},{"x":608.1105081292496,"y":319.00880792950255},{"x":610.3146356977905,"y":315.547312623187},{"x":612.4757124059993,"y":312.05877775088254},{"x":614.5934065857023,"y":308.54373871051615},{"x":616.6673932267975,"y":305.00273496770455},{"x":618.6973540271354,"y":301.4363099729601},{"x":620.68297744137,"y":297.84501107828567},{"x":622.6239587287721,"y":294.22938945317037},{"x":624.52,"y":290.59000000000003},{"x":625.3240363228592,"y":288.8768327091585},{"x":626.0265200809124,"y":287.11958112086575},{"x":626.6250472293592,"y":285.32425891372344},{"x":627.1175694844312,"y":283.49701005186995},{"x":627.502401333043,"y":281.6440877590632},{"x":627.7782258009672,"y":279.77183311885517},{"x":627.9440989597919,"y":277.88665337409134},{"x":627.9994531572399,"y":275.995},{"x":627.9440989597919,"y":274.1033466259087},{"x":627.7782258009672,"y":272.21816688114495},{"x":627.502401333043,"y":270.34591224093685},{"x":627.1175694844312,"y":268.4929899481301},{"x":626.6250472293592,"y":266.6657410862766},{"x":626.0265200809124,"y":264.8704188791343},{"x":625.3240363228592,"y":263.1131672908415},{"x":624.52,"y":261.40000000000003},{"x":621.9391984558106,"y":256.46536228179934},{"x":619.2814294433595,"y":251.58170684814456},{"x":616.5475526428223,"y":246.7498890304566},{"x":613.738427734375,"y":241.97076416015628},{"x":610.8549143981934,"y":237.2451875686646},{"x":607.8978723144531,"y":232.5740145874024},{"x":604.86816116333,"y":227.95810054779056},{"x":601.7666406249999,"y":223.39830078125001},{"x":598.5941703796387,"y":218.8954706192017},{"x":595.351610107422,"y":214.45046539306642},{"x":592.0398194885255,"y":210.06414043426517},{"x":588.6596582031249,"y":205.73735107421876},{"x":585.2119859313965,"y":201.47095264434813},{"x":581.6976623535156,"y":197.2658004760742},{"x":578.1175471496581,"y":193.12274990081787},{"x":574.4725,"y":189.04265625000002},{"x":570.7633805847167,"y":185.02637485504147},{"x":566.9910485839844,"y":181.07476104736327},{"x":563.1563636779784,"y":177.18867015838623},{"x":559.260185546875,"y":173.36895751953125},{"x":555.3033738708496,"y":169.61647846221922},{"x":551.2867883300781,"y":165.9320883178711},{"x":547.2112886047364,"y":162.31664241790773},{"x":543.077734375,"y":158.77099609375},{"x":538.886985321045,"y":155.29600467681885},{"x":534.6399011230469,"y":151.89252349853516},{"x":530.3373414611817,"y":148.56140789031983},{"x":525.980166015625,"y":145.30351318359376},{"x":521.5692344665526,"y":142.11969470977783},{"x":517.1054064941407,"y":139.01080780029298},{"x":512.5895417785644,"y":135.97770778656007},{"x":508.0225,"y":133.02125},{"x":503.4051408386231,"y":130.1422897720337},{"x":498.73832397460933,"y":127.34168243408205},{"x":494.0229090881347,"y":124.62028331756592},{"x":489.259755859375,"y":121.97894775390627},{"x":484.44972396850585,"y":119.41853107452393},{"x":479.59367309570314,"y":116.93988861083986},{"x":474.6924629211426,"y":114.54387569427492},{"x":469.746953125,"y":112.23134765625001},{"x":464.75800338745114,"y":110.00315982818603},{"x":459.72647338867193,"y":107.86016754150391},{"x":454.6532228088379,"y":105.80322612762451},{"x":449.539111328125,"y":103.83319091796875},{"x":444.38499862670903,"y":101.95091724395752},{"x":439.1917443847656,"y":100.15726043701171},{"x":433.9602082824707,"y":98.45307582855226},{"x":428.69125,"y":96.83921875},{"x":423.38572921752933,"y":95.3165445327759},{"x":418.0445056152344,"y":93.8859085083008},{"x":412.668438873291,"y":92.54816600799562},{"x":407.258388671875,"y":91.30417236328125},{"x":401.8152146911621,"y":90.15478290557861},{"x":396.33977661132815,"y":89.10085296630858},{"x":390.8329341125488,"y":88.14323787689209},{"x":385.295546875,"y":87.28279296875},{"x":379.72847457885746,"y":86.52037357330323},{"x":374.1325769042969,"y":85.85683502197267},{"x":368.5087135314942,"y":85.2930326461792},{"x":362.857744140625,"y":84.82982177734375},{"x":357.1805284118652,"y":84.46805774688721},{"x":351.4779260253906,"y":84.20859588623047},{"x":345.75079666137697,"y":84.05229152679443},{"x":340,"y":84},{"x":335.1985487025351,"y":84.04322831525934},{"x":330.3983538815045,"y":84.16126614528878},{"x":325.6005810436157,"y":84.35408483002584},{"x":320.806395107509,"y":84.6216375523145},{"x":316.0169601209104,"y":84.96385934927218},{"x":311.2334389779963,"y":85.38066712806318},{"x":306.4569931370377,"y":85.8719596860737},{"x":301.6887823383938,"y":86.43761773548471},{"x":296.9299643229224,"y":87.077503932235},{"x":292.18169455087525,"y":87.79146290936933},{"x":287.44512592134816,"y":88.57932131476178},{"x":282.72140849235234,"y":89.44088785320662},{"x":278.0116892015752,"y":90.37595333286532},{"x":273.3171115879,"y":91.38429071605941},{"x":268.6388155137493,"y":92.46565517439598},{"x":263.97793688832223,"y":93.61978414821306},{"x":259.33560739179086,"y":94.84639741033021},{"x":254.71295420052377,"y":96.14519713408873},{"x":250.11109971340306,"y":97.51586796566528},{"x":245.53116127930156,"y":98.95807710064082},{"x":240.97425092578567,"y":100.4714743648073},{"x":236.4414750891106,"y":102.05569229919092},{"x":231.93393434557373,"y":103.71034624927296},{"x":227.45272314428945,"y":105.43503445838536},{"x":222.99892954145287,"y":107.2293381652587},{"x":218.57363493615554,"y":109.09282170569946},{"x":214.1779138078171,"y":111.0250326183708},{"x":209.81283345529738,"y":113.02550175465205},{"x":205.47945373775215,"y":115.09374339254987},{"x":201.17882681729458,"y":117.22925535463372},{"x":196.9119969035265,"y":119.4315191299662},{"x":192.68,"y":121.69999999999987},{"x":129.07,"y":72.53499999999994},{"x":65.46000000000001,"y":23.37},{"x":64.82829033313763,"y":22.902878403528547},{"x":64.17441177454202,"y":22.46732987614459},{"x":63.4999409370092,"y":22.06440459967859},{"x":62.80650408483404,"y":21.695074095735556},{"x":62.09577321260943,"y":21.360228883190644},{"x":61.369462013762,"y":21.06067633099615},{"x":60.62932174854486,"y":20.79713871147722},{"x":59.87713702145016,"y":20.57025145880999},{"x":59.11472147822319,"y":20.380561636881335},{"x":58.3439134328529,"y":20.228526620224493},{"x":57.5665714350832,"y":20.114512991211004},{"x":56.78456978913232,"y":20.038795656158044},{"x":55.99979403442546,"y":20.001557182482387},{"x":55.214136399237475,"y":20.0028873584992},{"x":54.429491238207554,"y":20.042782976927107},{"x":53.64775046472691,"y":20.121147842621465},{"x":52.8707989892127,"y":20.237793004517293},{"x":52.10051017426735,"y":20.392437211222536},{"x":51.33874131768159,"y":20.584707589163166},{"x":50.587329174172524,"y":20.814140541644996},{"x":49.84808552665457,"y":21.08018286666445},{"x":49.122792817721596,"y":21.382193090772976},{"x":48.4131998518737,"y":21.71944301577902},{"x":47.72101757885103,"y":22.09111947455814},{"x":47.047914968242054,"y":22.496326291737724},{"x":46.395514985313014,"y":22.934086444528724},{"x":45.76539067776168,"y":23.40334441849439},{"x":45.159061382830906,"y":23.902968752575664},{"x":44.577989063927255,"y":24.431754767236924},{"x":44.02357478557771,"y":24.98842746915392},{"x":43.49715533522402,"y":25.571644625440264},{"x":43.00000000000001,"y":26.179999999999996},{"x":33.185,"y":38.815},{"x":23.369999999999997,"y":51.45},{"x":22.903442023840576,"y":52.08158103552398},{"x":22.468432203959118,"y":52.73529152661177},{"x":22.066018252924806,"y":53.409557024442165},{"x":21.697169376799753,"y":54.10275357386578},{"x":21.362773940825342,"y":54.81321162466893},{"x":21.06363732981206,"y":55.53922005265238},{"x":20.800480008386067,"y":56.279030280840274},{"x":20.573935785764373,"y":57.03086049089322},{"x":20.384550289237822,"y":57.79289991458265},{"x":20.232779650038545,"y":58.56331319499036},{"x":20.118989404756867,"y":59.34024480692944},{"x":20.04345361495367,"y":60.121823525940094},{"x":20.006354207088496,"y":60.906166935096806},{"x":20.007780534353277,"y":61.69138595877241},{"x":20.04772916146694,"y":62.47558941243941},{"x":20.126103872949194,"y":63.25688855755068},{"x":20.242715904853647,"y":64.03340165052893},{"x":20.397284399402,"y":64.803258474909},{"x":20.58943708142452,"y":65.56460484571738},{"x":20.818711154977407,"y":66.31560707524002},{"x":21.084554417977685,"y":67.05445638942317},{"x":21.386326592171077,"y":67.77937328426981},{"x":21.723300865229476,"y":68.48861181174016},{"x":22.094665641264168,"y":69.18046378483282},{"x":22.49952649553847,"y":69.85326289171972},{"x":22.93690832867208,"y":70.5053887090251},{"x":23.40575771514871,"y":71.13527060458333},{"x":23.904945440470634,"y":71.74139152027543},{"x":24.433269220849553,"y":72.32229162583374},{"x":24.989456598883354,"y":72.8765718348142},{"x":25.57216800824468,"y":73.40289717426846},{"x":26.180000000000014,"y":73.9},{"x":320.35999999999996,"y":301.265},{"x":614.54,"y":528.63},{"x":615.1717096668624,"y":529.0971215964714},{"x":615.825588225458,"y":529.5326701238555},{"x":616.5000590629908,"y":529.9355954003214},{"x":617.193495915166,"y":530.3049259042645},{"x":617.9042267873906,"y":530.6397711168094},{"x":618.630537986238,"y":530.9393236690039},{"x":619.3706782514552,"y":531.2028612885229},{"x":620.1228629785498,"y":531.4297485411901},{"x":620.8852785217769,"y":531.6194383631187},{"x":621.6560865671471,"y":531.7714733797756},{"x":622.4334285649168,"y":531.885487008789},{"x":623.2154302108677,"y":531.9612043438419},{"x":624.0002059655745,"y":531.9984428175176},{"x":624.7858636007626,"y":531.9971126415008},{"x":625.5705087617924,"y":531.9572170230729},{"x":626.3522495352731,"y":531.8788521573786},{"x":627.1292010107874,"y":531.7622069954828},{"x":627.8994898257326,"y":531.6075627887775},{"x":628.6612586823185,"y":531.4152924108369},{"x":629.4126708258275,"y":531.185859458355},{"x":630.1519144733454,"y":530.9198171333355},{"x":630.8772071822784,"y":530.617806909227},{"x":631.5868001481264,"y":530.280556984221},{"x":632.2789824211491,"y":529.9088805254419},{"x":632.952085031758,"y":529.5036737082623},{"x":633.604485014687,"y":529.0659135554713},{"x":634.2346093222384,"y":528.5966555815056},{"x":634.8409386171692,"y":528.0970312474244},{"x":635.4220109360728,"y":527.568245232763},{"x":635.9764252144223,"y":527.011572530846},{"x":636.502844664776,"y":526.4283553745597},{"x":637,"y":525.8199999999999},{"x":646.8199999999999,"y":513.185},{"x":656.64,"y":500.55},{"x":657.1063472490254,"y":499.91819503526636},{"x":657.5411333621701,"y":499.2642697291709},{"x":657.9433110190528,"y":498.5897992684093},{"x":658.3119114471109,"y":497.8964083292048},{"x":658.6460467551972,"y":497.18576716375935},{"x":658.9449120723469,"y":496.4595875769211},{"x":659.2077874865655,"y":495.719618802759},{"x":659.434039778965,"y":494.96764329097715},{"x":659.6231239490729,"y":494.205472413319},{"x":659.7745845276384,"y":493.4349421003032},{"x":659.8880566737752,"y":492.6579084188024},{"x":659.9632670537962,"y":491.8762431011167},{"x":660.0000344996249,"y":491.0918290363124},{"x":659.9982704451957,"y":490.3065557346858},{"x":659.9579791397936,"y":489.5223147762779},{"x":659.8792576378187,"y":488.74099525440323},{"x":659.7622955649995,"y":487.96447922516916},{"x":659.6073746616194,"y":487.19463717394603},{"x":659.4148681038556,"y":486.43332350970934},{"x":659.1852396048658,"y":485.6823720981071},{"x":658.9190422977882,"y":484.9435918440125},{"x":658.6169174033441,"y":484.21876233420153},{"x":658.2795926852549,"y":483.5096295506542},{"x":657.9078806971916,"y":482.817901664802},{"x":657.5026768254818,"y":482.1452449228548},{"x":657.0649571322871,"y":481.49327963211834},{"x":656.5957760044475,"y":480.86357625796916},{"x":656.0962636136567,"y":480.2576516408904},{"x":655.5676231940836,"y":479.67696534268015},{"x":655.0111281440018,"y":479.12291613063303},{"x":654.4281189584051,"y":478.5968386081656}],[],[{"x":470.0999999999999,"y":336.1},{"x":450.44999999999993,"y":320.91},{"x":430.79999999999995,"y":305.71999999999997},{"x":431.40130787145887,"y":303.9242547258393},{"x":431.9666063019739,"y":302.11685052909576},{"x":432.4956694714439,"y":300.2985094146017},{"x":432.988286034689,"y":298.4699577561667},{"x":433.4442592058769,"y":296.63192600641213},{"x":433.86340683713297,"y":294.7851484049773},{"x":434.24556149130296,"y":292.930362685212},{"x":434.5905705088393,"y":291.0683097794739},{"x":434.8982960687839,"y":289.1997335231478},{"x":435.1686152438239,"y":287.32538035750514},{"x":435.40142004939725,"y":285.4459990315229},{"x":435.59661748682936,"y":283.56234030278006},{"x":435.75412958048355,"y":281.67515663755256},{"x":435.8738934089098,"y":279.7852019102245},{"x":435.95586112998006,"y":277.893231102138},{"x":436,"y":275.9999999999999},{"x":435.99605743513746,"y":273.2342366339812},{"x":435.91140063391276,"y":270.4697663833482},{"x":435.74610171415947,"y":267.70894425801},{"x":435.5003014914983,"y":264.9541221600937},{"x":435.1742093593781,"y":262.20764688039463},{"x":434.7681031106968,"y":259.4718580991817},{"x":434.2823287011542,"y":256.7490863930591},{"x":433.7172999545372,"y":254.0416512495838},{"x":433.07349821019,"y":251.3518590913299},{"x":432.35147191296807,"y":248.68200131108233},{"x":431.5518361460269,"y":246.03435231983428},{"x":430.6752721068416,"y":243.41116760925144},{"x":429.72252652690537,"y":240.8146818302531},{"x":428.69441103560047,"y":238.24710688934732},{"x":427.5918014687834,"y":235.71063006434142},{"x":426.41563712267384,"y":233.20741214103364},{"x":425.1669199536825,"y":230.7395855724728},{"x":423.8467137248599,"y":228.30925266235403},{"x":422.45614309969267,"y":225.9184837740985},{"x":420.99639268402024,"y":223.56931556714255},{"x":419.468706016887,"y":221.26374926193859},{"x":417.87438451119056,"y":219.00374893514606},{"x":416.2147863450279,"y":216.79123984646458},{"x":414.49132530468444,"y":214.62810679853462},{"x":412.7054695802509,"y":212.51619253130303},{"x":410.85874051489463,"y":210.4572961522211},{"x":408.95271130885084,"y":208.45317160361225},{"x":406.98900567923727,"y":206.50552616851567},{"x":404.96929647683436,"y":204.6160190162779},{"x":402.89530426100947,"y":202.7862597891318},{"x":400.76879583399847,"y":201.01780723096704},{"x":398.5915827357939,"y":199.31216785945998},{"x":396.36551970092205,"y":197.6707946826943},{"x":394.0925030784229,"y":196.09508596136573},{"x":391.7744692163791,"y":194.58638401762508},{"x":389.413392812371,"y":193.14597409157457},{"x":387.011285231262,"y":191.77508324639143},{"x":384.5701927917472,"y":190.47487932301158},{"x":382.0921950231264,"y":189.24646994526373},{"x":379.5794028937844,"y":188.09090157630175},{"x":377.03395701288963,"y":187.0091586271385},{"x":374.4580258068418,"y":186.00216261804138},{"x":371.85380367202276,"y":185.07077139350315},{"x":369.22350910542355,"y":184.21577839145738},{"x":366.5693828147411,"y":183.4379119673608},{"x":363.8936858095534,"y":182.73783477371848},{"x":361.1986974752001,"y":182.11614319558032},{"x":358.4867136310089,"y":181.57336684248952},{"x":355.76004457452245,"y":181.10996809731674},{"x":353.02101311339095,"y":180.72634172236275},{"x":350.271952586608,"y":180.4228145230668},{"x":347.5152048767748,"y":180.19964506960582},{"x":344.75311841508625,"y":180.05702347662276},{"x":341.988046180738,"y":179.99507124127044},{"x":339.2223436964601,"y":180.01384113971028},{"x":336.4583670218826,"y":180.11331718215303},{"x":333.69847074644485,"y":180.29341462648011},{"x":330.9450059835564,"y":180.55398005043423},{"x":328.20031836771994,"y":180.8947914823175},{"x":325.46674605632063,"y":181.31555859008563},{"x":322.746617737786,"y":181.81592292867742},{"x":320.04225064781167,"y":182.3954582453685},{"x":317.3559485953438,"y":183.05367084288972},{"x":314.6899999999998,"y":183.7900000000001},{"x":315.78077247564744,"y":185.33102652380168},{"x":316.80964175994575,"y":186.91405379347137},{"x":317.774992606505,"y":188.53659657680183},{"x":318.6753094880432,"y":190.19610760523997},{"x":319.50917897564875,"y":191.88998157290428},{"x":320.27529195775617,"y":193.6155592267167},{"x":320.97244569535144,"y":195.37013154122738},{"x":321.59954571018056,"y":197.15094397157813},{"x":322.1556075029971,"y":198.95520077792807},{"x":322.63975809915104,"y":200.78006941455214},{"x":323.05123741909244,"y":202.6226849767221},{"x":323.3893994716383,"y":204.48015469838876},{"x":323.6537133681297,"y":206.3495624936041},{"x":323.84376415588645,"y":208.22797353455425},{"x":323.9592534696511,"y":210.11243885901544},{"x":324,"y":211.99999999999991},{"x":323.92691977582797,"y":213.26508082024776},{"x":323.8194979640393,"y":214.52770933064818},{"x":323.6778138620041,"y":215.7869534754249},{"x":323.50197205906477,"y":217.0418836970958},{"x":323.2921023593298,"y":218.2915736226602},{"x":323.0483596858541,"y":219.53510074743508},{"x":322.7709239662766,"y":220.77154711603603},{"x":322.46000000000004,"y":221.9999999999999},{"x":285.655,"y":193.55499999999995},{"x":248.84999999999997,"y":165.11},{"x":251.24433132201136,"y":163.15291513896372},{"x":253.68062248678223,"y":161.24831833299083},{"x":256.15772308424494,"y":159.39710892751765},{"x":258.67446343422864,"y":157.6001610585949},{"x":261.2296551387792,"y":155.85832324012318},{"x":263.8220916433172,"y":154.1724179631871},{"x":266.45054880636997,"y":152.54324130767708},{"x":269.1137854776078,"y":150.97156256638272},{"x":271.81054408391157,"y":149.4581238817347},{"x":274.5395512231956,"y":148.00363989536737},{"x":277.2995182657046,"y":146.60879741066663},{"x":280.0891419625011,"y":145.27425506846328},{"x":282.9071050608561,"y":144.00064303602485},{"x":285.75207692625213,"y":142.78856270949214},{"x":288.62271417070525,"y":141.6385864299016},{"x":291.51766128710943,"y":140.55125721292748},{"x":294.435551289303,"y":139.52708849247128},{"x":297.37500635755623,"y":138.56656387821974},{"x":300.33463848917347,"y":137.67013692728557},{"x":303.3130501539048,"y":136.83823093003897},{"x":306.30883495385564,"y":136.07123871023126},{"x":309.3205782875844,"y":135.36952243950438},{"x":312.34685801807296,"y":134.73341346637451},{"x":315.3862451442563,"y":134.16321215977015},{"x":318.43730447579276,"y":133.6591877671989},{"x":321.4985953107569,"y":133.22157828760916},{"x":324.5686721159353,"y":132.8505903590081},{"x":327.64608520940334,"y":132.54639916088743},{"x":330.72938144506077,"y":132.30914833150436},{"x":333.8171048988038,"y":132.13894990005574},{"x":336.9077975560082,"y":132.03588423377846},{"x":339.99999999999994,"y":132},{"x":343.5344971396533,"y":132.04144216412328},{"x":347.0669104856565,"y":132.16967412645533},{"x":350.59510923065704,"y":132.38461853545732},{"x":354.1169651096163,"y":132.68614573327716},{"x":357.6303536836121,"y":133.07407383396125},{"x":361.13315562133414,"y":133.54816883317085},{"x":364.6232579774977,"y":134.10814474933719},{"x":368.0985554674057,"y":134.75366379617023},{"x":371.5569517368894,"y":135.48433658641636},{"x":374.99636062686244,"y":136.29972236674323},{"x":378.4147074317247,"y":137.19932928360888},{"x":381.8099301508576,"y":138.18261467995566},{"x":385.17998073245496,"y":139.2489854225495},{"x":388.52282630894047,"y":140.39779825976717},{"x":391.83645042322524,"y":141.62836020961578},{"x":395.1188542450666,"y":142.93992897775055},{"x":398.36805777679365,"y":144.33171340523825},{"x":401.58210104767346,"y":145.80287394579688},{"x":404.7590452961961,"y":147.35252317222321},{"x":407.89697413956605,"y":148.9797263117028},{"x":410.99399472969435,"y":150.68350180967954},{"x":414.0482388949948,"y":152.4628219219451},{"x":417.05786426729424,"y":154.3166133345902},{"x":420.0210553931777,"y":156.24375781144457},{"x":422.93602482909915,"y":158.2430928686145},{"x":425.80101421959506,"y":160.31341247571163},{"x":428.61429535795236,"y":162.4534677833492},{"x":431.37417122868993,"y":164.6619678764679},{"x":434.07897703122495,"y":166.93758055303613},{"x":436.72708118410685,"y":169.27893312765502},{"x":439.31688630921303,"y":171.68461325958413},{"x":441.8468301953124,"y":174.15316980468762},{"x":444.3153867404159,"y":176.68311369078702},{"x":446.72106687234503,"y":179.27291881589318},{"x":449.06241944696393,"y":181.9210229687751},{"x":451.3380321235321,"y":184.62582877131007},{"x":453.5465322166508,"y":187.38570464204764},{"x":455.6865875242884,"y":190.198985780405},{"x":457.7569071313855,"y":193.0639751709009},{"x":459.75624218855546,"y":195.97894460682232},{"x":461.68338666540984,"y":198.94213573270582},{"x":463.5371780780549,"y":201.95176110500518},{"x":465.3164981903205,"y":205.00600527030565},{"x":467.02027368829727,"y":208.103025860434},{"x":468.6474768277768,"y":211.24095470380388},{"x":470.1971260542032,"y":214.41789895232654},{"x":471.66828659476175,"y":217.63194222320638},{"x":473.0600710222495,"y":220.88114575493344},{"x":474.3716397903842,"y":224.16354957677476},{"x":475.6022017402329,"y":227.47717369105953},{"x":476.7510145774505,"y":230.82001926754506},{"x":477.81738532004437,"y":234.19006984914242},{"x":478.80067071639115,"y":237.5852925682753},{"x":479.7002776332568,"y":241.0036393731376},{"x":480.51566341358364,"y":244.44304826311063},{"x":481.2463362038298,"y":247.90144453259433},{"x":481.89185525066284,"y":251.3767420225023},{"x":482.45183116682915,"y":254.86684437866586},{"x":482.9259261660388,"y":258.3696463163879},{"x":483.31385426672284,"y":261.8830348903838},{"x":483.6153814645427,"y":265.40489076934296},{"x":483.83032587354467,"y":268.9330895143436},{"x":483.9585578358767,"y":272.46550286034676},{"x":484,"y":276.00000000000006},{"x":483.9845620727539,"y":278.0234945678711},{"x":483.93848876953126,"y":280.0383081054688},{"x":483.8621408081055,"y":282.0443728637695},{"x":483.75587890625,"y":284.04162109375005},{"x":483.6200637817383,"y":286.02998504638674},{"x":483.45505615234373,"y":288.0093969726563},{"x":483.26121673583987,"y":289.9797891235352},{"x":483.03890625,"y":291.94109375000005},{"x":482.7884854125976,"y":293.8932431030274},{"x":482.51031494140625,"y":295.8361694335938},{"x":481.87216796875,"y":299.69408203125005},{"x":481.1273510742187,"y":303.5142895507813},{"x":480.27875,"y":307.29625000000004},{"x":479.3292504882813,"y":311.0394213867188},{"x":478.28173828125,"y":314.74326171875003},{"x":477.13909912109375,"y":318.40722900390625},{"x":475.90421875,"y":322.0307812500001},{"x":474.5799829101562,"y":325.6133764648438},{"x":473.16927734374997,"y":329.15447265625005},{"x":471.67498779296875,"y":332.6535278320313},{"x":470.1,"y":336.11},{"x":470.09999999999997,"y":336.105}],[]]}' ) );
  }
}

alpenglow.register( 'TestToCanvas', TestToCanvas );
