// Copyright 2023-2025, University of Colorado Boulder

/**
 * Enumeration of color spaces we'll want to convert from/to
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderColor } from './RenderColor.js';
import { RenderLinearDisplayP3ToLinearSRGB } from './RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderLinearSRGBToLinearDisplayP3 } from './RenderLinearSRGBToLinearDisplayP3.js';
import { RenderLinearSRGBToOklab } from './RenderLinearSRGBToOklab.js';
import { RenderLinearSRGBToSRGB } from './RenderLinearSRGBToSRGB.js';
import { RenderOklabToLinearSRGB } from './RenderOklabToLinearSRGB.js';
import type { RenderProgram } from './RenderProgram.js';
import { RenderSRGBToLinearSRGB } from './RenderSRGBToLinearSRGB.js';

export class RenderColorSpace {
  protected constructor(
    public readonly name: string,
    public readonly isPremultiplied: boolean,
    public readonly isLinear: boolean,
    public readonly toLinear?: ( color: Vector4 ) => Vector4,
    public readonly fromLinear?: ( color: Vector4 ) => Vector4,
    public readonly linearToLinearSRGB?: ( color: Vector4 ) => Vector4,
    public readonly linearSRGBToLinear?: ( color: Vector4 ) => Vector4,
    public readonly toLinearRenderProgram?: ( renderProgram: RenderProgram ) => RenderProgram,
    public readonly fromLinearRenderProgram?: ( renderProgram: RenderProgram ) => RenderProgram,
    public readonly linearToLinearSRGBRenderProgram?: ( renderProgram: RenderProgram ) => RenderProgram,
    public readonly linearSRGBToLinearRenderProgram?: ( renderProgram: RenderProgram ) => RenderProgram
  ) {}

  // TODO: better patterns for conversions

  // TODO: remove this or fully support it
  public static readonly XYZ = new RenderColorSpace(
    'XYZ',
    false,
    true,
    _.identity,
    _.identity,
    RenderColor.xyzToLinear,
    RenderColor.linearToXYZ
  );

  // TODO: remove this or fully support it
  public static readonly xyY = new RenderColorSpace(
    'xyY',
    false,
    false
  );

  public static readonly sRGB = new RenderColorSpace(
    'srgb',
    false,
    false,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    _.identity,
    _.identity,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    _.identity,
    _.identity
  );
  public static readonly premultipliedSRGB = new RenderColorSpace(
    'srgb',
    true,
    false,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    _.identity,
    _.identity,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    _.identity,
    _.identity
  );
  public static readonly linearSRGB = new RenderColorSpace(
    'srgb',
    false,
    true,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    _.identity,
    _.identity,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    _.identity,
    _.identity
  );
  public static readonly premultipliedLinearSRGB = new RenderColorSpace(
    'srgb',
    true,
    true,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    _.identity,
    _.identity,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    _.identity,
    _.identity
  );

  public static readonly displayP3 = new RenderColorSpace(
    'display-p3',
    false,
    false,
    RenderColor.displayP3ToLinearDisplayP3,
    RenderColor.linearDisplayP3ToDisplayP3,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    renderProgram => new RenderLinearDisplayP3ToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToLinearDisplayP3( renderProgram )
  );
  public static readonly premultipliedDisplayP3 = new RenderColorSpace(
    'display-p3',
    true,
    false,
    RenderColor.displayP3ToLinearDisplayP3,
    RenderColor.linearDisplayP3ToDisplayP3,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    renderProgram => new RenderLinearDisplayP3ToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToLinearDisplayP3( renderProgram )
  );
  public static readonly linearDisplayP3 = new RenderColorSpace(
    'display-p3',
    false,
    true,
    RenderColor.displayP3ToLinearDisplayP3,
    RenderColor.linearDisplayP3ToDisplayP3,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    renderProgram => new RenderLinearDisplayP3ToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToLinearDisplayP3( renderProgram )
  );
  public static readonly premultipliedLinearDisplayP3 = new RenderColorSpace(
    'display-p3',
    true,
    true,
    RenderColor.displayP3ToLinearDisplayP3,
    RenderColor.linearDisplayP3ToDisplayP3,
    RenderColor.sRGBToLinear,
    RenderColor.linearToSRGB,
    renderProgram => new RenderSRGBToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToSRGB( renderProgram ),
    renderProgram => new RenderLinearDisplayP3ToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToLinearDisplayP3( renderProgram )
  );

  public static readonly oklab = new RenderColorSpace(
    'oklab',
    false,
    false,
    // TODO: hmmm, we don't really have the "linear oklab" concept here
    RenderColor.oklabToLinear,
    RenderColor.linearToOklab,
    _.identity,
    _.identity,
    renderProgram => new RenderOklabToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToOklab( renderProgram ),
    _.identity,
    _.identity
  );
  public static readonly premultipliedOklab = new RenderColorSpace(
    'oklab',
    true,
    false,
    // TODO: hmmm, we don't really have the "linear oklab" concept here
    RenderColor.oklabToLinear,
    RenderColor.linearToOklab,
    _.identity,
    _.identity,
    renderProgram => new RenderOklabToLinearSRGB( renderProgram ),
    renderProgram => new RenderLinearSRGBToOklab( renderProgram ),
    _.identity,
    _.identity
  );
}

alpenglow.register( 'RenderColorSpace', RenderColorSpace );