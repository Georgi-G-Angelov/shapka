import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

/// Shrinks slightly while pressed (design: Pressable).
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.scale = 0.97, this.label, this.button = true, this.selected});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? label;
  final bool button;
  final bool? selected;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return Semantics(
      button: widget.button,
      enabled: enabled,
      selected: widget.selected,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: enabled ? () => setState(() => _down = false) : null,
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? widget.scale : 1,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      ),
    );
  }
}

/// A softly pulsing glow around a call to action (design: ctaGlow).
class Glow extends StatefulWidget {
  const Glow({super.key, required this.child, required this.color, this.radius = 16, this.enabled = true});
  final Widget child;
  final Color color;
  final double radius;
  final bool enabled;

  @override
  State<Glow> createState() => _GlowState();
}

class _GlowState extends State<Glow> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1900));
    if (widget.enabled) _c.repeat();
  }

  @override
  void didUpdateWidget(Glow old) {
    super.didUpdateWidget(old);
    if (widget.enabled && !_c.isAnimating) _c.repeat();
    if (!widget.enabled) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || MediaQuery.of(context).disableAnimations) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = math.sin(_c.value * math.pi);
        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            boxShadow: [BoxShadow(color: widget.color, blurRadius: 6 + 16 * t, spreadRadius: 6 * t)],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

enum ButtonTone { primary, light, danger, ghost }

/// 56px tall, radius 16, the web client's purple gradient.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.tone = ButtonTone.primary,
    this.glow = false,
    this.busy = false,
    this.height = 56,
  });
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final ButtonTone tone;
  final bool glow;
  final bool busy;
  final double height;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final disabled = onPressed == null;
    final (Gradient? gradient, Color? fill, Color fg, Color glowColor) = switch (tone) {
      ButtonTone.primary => (p.primaryGradient, null, Colors.white, p.primary.withValues(alpha: 0.55)),
      ButtonTone.light => (null, Colors.white, const Color(0xFF4A1559), Colors.white.withValues(alpha: 0.45)),
      ButtonTone.danger => (null, p.danger, Colors.white, p.danger.withValues(alpha: 0.5)),
      ButtonTone.ghost => (null, p.surfaceAlt, p.text, Colors.transparent),
    };
    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: disabled ? null : gradient,
        color: disabled ? p.surfaceAlt : fill,
      ),
      alignment: Alignment.center,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (busy)
            SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: disabled ? p.text3 : fg))
          else if (icon != null)
            Icon(icon, size: 22, color: disabled ? p.text3 : fg),
          if (busy || icon != null) const SizedBox(width: 8),
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: disabled ? p.text3 : fg)),
          ),
        ],
      ),
    );
    return Pressable(
      onTap: busy ? null : onPressed,
      label: label,
      child: Glow(color: glowColor, enabled: glow && !disabled && tone != ButtonTone.ghost, child: box),
    );
  }
}

/// Outlined button on the stage (white outline).
class StageOutlineButton extends StatelessWidget {
  const StageOutlineButton({super.key, required this.label, this.icon, this.onPressed});
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onPressed,
        label: label,
        child: Opacity(
          opacity: onPressed == null ? 0.4 : 1,
          child: Container(
            height: 52,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white38, width: 2)),
            alignment: Alignment.center,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 20, color: Colors.white), const SizedBox(width: 8)],
              Flexible(
                child: Text(label,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ]),
          ),
        ),
      );
}

class AppIconButton extends StatelessWidget {
  const AppIconButton({super.key, required this.icon, required this.label, this.onPressed, this.color, this.background, this.size = 24});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final Color? color;
  final Color? background;
  final double size;

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onPressed,
        label: label,
        scale: 0.9,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: background, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Icon(icon, size: size, color: color ?? Palette.of(context).text2),
        ),
      );
}

class TextAction extends StatelessWidget {
  const TextAction({super.key, required this.label, this.icon, this.onPressed, this.color});
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Palette.of(context).primary;
    return Pressable(
      onTap: onPressed,
      label: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 19, color: c), const SizedBox(width: 6)],
          Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c))),
        ]),
      ),
    );
  }
}

/// Filled text field, radius 14, with the error shown under it.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    this.label,
    required this.controller,
    this.placeholder,
    this.error,
    this.big = false,
    this.nested = false,
    this.numeric = false,
    this.autofocus = false,
    this.maxLength,
    this.capitalization = TextCapitalization.words,
    this.action = TextInputAction.done,
    this.onSubmitted,
    this.onChanged,
    this.trailing,
    this.focusNode,
  });
  final String? label;
  final TextEditingController controller;
  final String? placeholder;
  final String? error;
  final bool big;
  final bool nested;
  final bool numeric;
  final bool autofocus;
  final int? maxLength;
  final TextCapitalization capitalization;
  final TextInputAction action;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final Widget? trailing;
  final FocusNode? focusNode;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    if (widget.focusNode == null) _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final error = widget.error;
    final focused = _focus.hasFocus;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Text(widget.label!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.text2)),
          ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: widget.big ? 72 : 56,
          padding: EdgeInsets.only(left: 16, right: widget.trailing == null ? 16 : 6),
          decoration: BoxDecoration(
            color: widget.nested ? p.surfaceAlt : p.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(width: 2, color: error != null ? p.danger : focused ? p.primary : Colors.transparent),
            boxShadow: [
              if (focused) BoxShadow(color: p.primary.withValues(alpha: 0.12), spreadRadius: 4),
              if (!focused && !widget.nested) BoxShadow(color: p.border, offset: const Offset(0, 1)),
            ],
          ),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                autofocus: widget.autofocus,
                textAlign: widget.big ? TextAlign.center : TextAlign.start,
                keyboardType: widget.numeric ? TextInputType.number : TextInputType.text,
                inputFormatters: [
                  if (widget.numeric) FilteringTextInputFormatter.digitsOnly,
                  if (widget.maxLength != null) LengthLimitingTextInputFormatter(widget.maxLength),
                ],
                textCapitalization: widget.capitalization,
                textInputAction: widget.action,
                autocorrect: false,
                enableSuggestions: false,
                onSubmitted: widget.onSubmitted,
                onChanged: widget.onChanged,
                style: TextStyle(
                  fontSize: widget.big ? 34 : 18,
                  fontWeight: widget.big ? FontWeight.w800 : FontWeight.w600,
                  letterSpacing: widget.big && widget.controller.text.isNotEmpty ? 8 : 0,
                  color: p.text,
                ),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  hintText: widget.placeholder,
                  hintStyle: TextStyle(color: p.text3, fontSize: widget.big ? 22 : 18, fontWeight: FontWeight.w600, letterSpacing: 0),
                ),
              ),
            ),
            if (widget.trailing != null) widget.trailing!,
          ]),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.error_outline_rounded, size: 16, color: p.danger),
              const SizedBox(width: 6),
              Expanded(
                child: Semantics(
                  liveRegion: true,
                  child: Text(error, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.danger, height: 1.35)),
                ),
              ),
            ]),
          ),
      ],
    );
  }
}

class NumberStepper extends StatelessWidget {
  const NumberStepper({super.key, required this.value, required this.min, required this.max, required this.onChanged, required this.noun});
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;
  final String noun;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: p.border, offset: const Offset(0, 1))],
      ),
      child: Row(children: [
        AppIconButton(
          icon: Icons.remove_rounded,
          label: 'Fewer $noun',
          color: value > min ? p.primary : p.border,
          onPressed: value > min ? () => onChanged(value - 1) : null,
        ),
        Expanded(
          child: Semantics(
            liveRegion: true,
            child: Text('$value',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: p.text, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ),
        AppIconButton(
          icon: Icons.add_rounded,
          label: 'More $noun',
          color: value < max ? p.primary : p.border,
          onPressed: value < max ? () => onChanged(value + 1) : null,
        ),
      ]),
    );
  }
}

String initials(String name, [int letters = 2]) => name.trim().characters.take(letters).toString().toUpperCase();

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.size = 40, this.color, this.onStage = false, this.letters});
  final String name;
  final double size;
  final Color? color;
  final bool onStage;
  final int? letters;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final c = color ?? nameColor(name);
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: onStage ? Colors.white : Color.alphaBlend(c.withValues(alpha: 0.16), p.surface)),
        alignment: Alignment.center,
        child: Text(initials(name, letters ?? (size < 32 ? 1 : 2)),
            style: TextStyle(color: c, fontWeight: FontWeight.w800, fontSize: size * 0.38, height: 1)),
      ),
    );
  }
}

/// Two overlapping avatars for a team.
class Pair extends StatelessWidget {
  const Pair({super.key, required this.names, required this.color, this.size = 30, this.onStage = false});
  final List<String> names;
  final Color color;
  final double size;
  final bool onStage;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return SizedBox(
      width: size + (names.length - 1) * size * 0.7,
      height: size,
      child: Stack(children: [
        for (var i = 0; i < names.length; i++)
          Positioned(
            left: i * size * 0.7,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: onStage ? color.withValues(alpha: 0.9) : p.surface, width: 2),
              ),
              child: Avatar(name: names[i], size: size - 4, color: color, onStage: onStage, letters: 1),
            ),
          ),
      ]),
    );
  }
}

/// Back/close leading, centred title, optional trailing (design: TopBar).
class TopBar extends StatelessWidget {
  const TopBar({super.key, required this.title, this.onBack, this.close = false, this.trailing, this.color});
  final String title;
  final VoidCallback? onBack;
  final bool close;
  final Widget? trailing;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Palette.of(context).text;
    return SizedBox(
      height: 52,
      child: Row(children: [
        SizedBox(
          width: 88,
          child: Align(
            alignment: Alignment.centerLeft,
            child: onBack == null
                ? null
                : Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: AppIconButton(
                      icon: close ? Icons.close_rounded : Icons.arrow_back_ios_new_rounded,
                      label: close ? 'Close' : 'Back',
                      color: c,
                      size: close ? 26 : 20,
                      onPressed: onBack,
                    ),
                  ),
          ),
        ),
        Expanded(
          child: Semantics(
            header: true,
            child: Text(title,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c)),
          ),
        ),
        SizedBox(width: 88, child: Align(alignment: Alignment.centerRight, child: Padding(padding: const EdgeInsets.only(right: 6), child: trailing))),
      ]),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Text(text.toUpperCase(),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: p.text3)),
        ),
        ?trailing,
      ]),
    );
  }
}

class CardBox extends StatelessWidget {
  const CardBox({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.border, this.shadow = true});
  final Widget child;
  final EdgeInsets padding;
  final Color? border;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border ?? Colors.transparent, width: 2),
        boxShadow: shadow ? [BoxShadow(color: p.cardShadow, blurRadius: 30, offset: const Offset(0, 10), spreadRadius: -14)] : null,
      ),
      child: child,
    );
  }
}

/// Bottom-anchored actions above the home indicator.
class BottomBar extends StatelessWidget {
  const BottomBar({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        minimum: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 10), children[i]],
          ]),
        ),
      );
}

class HatLogo extends StatelessWidget {
  const HatLogo({super.key, this.size = 120, this.bob = false});
  final double size;
  final bool bob;

  @override
  Widget build(BuildContext context) {
    final image = Image.asset('assets/images/hat.png', width: size, height: size, fit: BoxFit.contain, excludeFromSemantics: true);
    return bob && !MediaQuery.of(context).disableAnimations ? _Bob(child: image) : image;
  }
}

class _Bob extends StatefulWidget {
  const _Bob({required this.child});
  final Widget child;

  @override
  State<_Bob> createState() => _BobState();
}

class _BobState extends State<_Bob> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 3200))..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final t = math.sin(_c.value * 2 * math.pi);
          return Transform.translate(offset: Offset(0, -3 - 3 * t), child: Transform.rotate(angle: t * 0.05, child: child));
        },
        child: widget.child,
      );
}

class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.size = 44, this.color});
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text('shapka',
      style: TextStyle(
        fontFamily: 'MetalMania',
        fontSize: size,
        height: 1,
        letterSpacing: size * 0.02,
        color: color ?? Palette.of(context).primary,
        shadows: color == Colors.white ? const [Shadow(color: Color(0x8CCE93D8), blurRadius: 18, offset: Offset(0, 4))] : null,
      ));
}

/// Timer ring: full = one turn. The last ten seconds turn red.
class TimerRing extends StatelessWidget {
  const TimerRing({super.key, required this.ms, required this.total, this.size = 200, this.label});
  final int ms;
  final int total;
  final double size;
  final String? label;

  static String format(int ms) {
    final total = (ms.clamp(0, 1 << 30) / 1000).ceil();
    return '${total ~/ 60}:${(total % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final urgent = ms > 0 && ms <= 10000;
    final color = ms <= 0 ? Colors.white38 : urgent ? AppPalette.urgent : Colors.white;
    final seconds = (ms / 1000).ceil();
    return Semantics(
      label: '$seconds seconds left',
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _RingPainter(progress: total <= 0 ? 0 : (ms / total).clamp(0, 1), color: color, stroke: math.max(8, size * 0.07)),
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(format(ms),
                  style: TextStyle(
                    fontSize: size * 0.26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    height: 1,
                    color: urgent ? AppPalette.urgent : Colors.white,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  )),
              if (label != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(label!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white70)),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color, required this.stroke});
  final double progress;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    canvas.drawArc(r, 0, 2 * math.pi, false, Paint()
      ..color = Colors.white.withValues(alpha: 0.14)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke);
    if (progress > 0) {
      canvas.drawArc(r, -math.pi / 2, 2 * math.pi * progress, false, Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = stroke);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}

/// Bottom sheet with the design's handle and padding.
Future<T?> showAppSheet<T>(BuildContext context, {required WidgetBuilder builder}) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Palette.of(context).bg,
      barrierColor: const Color(0x8C14061A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(sheetContext).size.height * 0.88),
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 16),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Center(
                child: Container(
                  width: 40,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(color: Palette.of(sheetContext).border, borderRadius: BorderRadius.circular(99)),
                ),
              ),
              builder(sheetContext),
            ]),
          ),
        ),
      ),
    );

class SheetTitle extends StatelessWidget {
  const SheetTitle({super.key, required this.title, this.subtitle, this.icon, this.color});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final c = color ?? p.primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(children: [
        if (icon != null)
          Container(
            width: 56,
            height: 56,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: c.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(18)),
            child: Icon(icon, size: 30, color: c),
          ),
        Text(title, textAlign: TextAlign.center, style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: p.text)),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(subtitle!, textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: p.text2, height: 1.4)),
          ),
      ]),
    );
  }
}

/// Confirm sheet; resolves true when confirmed.
Future<bool> confirmSheet(BuildContext context,
    {required IconData icon, required String title, required String subtitle, required String confirm}) async {
  final result = await showAppSheet<bool>(context, builder: (c) {
    final p = Palette.of(c);
    return Column(children: [
      SheetTitle(icon: icon, title: title, subtitle: subtitle, color: p.danger),
      AppButton(label: confirm, tone: ButtonTone.danger, onPressed: () => Navigator.pop(c, true)),
      const SizedBox(height: 10),
      AppButton(label: 'Cancel', tone: ButtonTone.ghost, onPressed: () => Navigator.pop(c, false)),
    ]);
  });
  return result ?? false;
}

// ── Toasts ────────────────────────────────────────────────────────────────

class ToastMessage {
  ToastMessage(this.text, {this.icon, this.color});
  final String text;
  final IconData? icon;
  final Color? color;
}

/// App-wide toast slot rendered above every route (design: Toast).
class Toasts extends ChangeNotifier {
  ToastMessage? current;
  Timer? _timer;

  void show(ToastMessage message, {Duration duration = const Duration(milliseconds: 2600)}) {
    current = message;
    _timer?.cancel();
    _timer = Timer(duration, () {
      current = null;
      notifyListeners();
    });
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class ToastLayer extends StatelessWidget {
  const ToastLayer({super.key, required this.toasts});
  final Toasts toasts;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return ListenableBuilder(
      listenable: toasts,
      builder: (context, _) {
        final t = toasts.current;
        return SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: SlideTransition(position: Tween(begin: const Offset(0, -0.4), end: Offset.zero).animate(a), child: child),
                ),
                child: t == null
                    ? const SizedBox.shrink()
                    : Semantics(
                        key: ObjectKey(t),
                        liveRegion: true,
                        child: Material(
                          color: Colors.transparent,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: p.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border(left: BorderSide(color: t.color ?? p.primary, width: 4)),
                              boxShadow: const [BoxShadow(color: Color(0x7314061A), blurRadius: 30, offset: Offset(0, 12), spreadRadius: -10)],
                            ),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(t.icon ?? Icons.info_outline_rounded, size: 22, color: t.color ?? p.primary),
                              const SizedBox(width: 10),
                              Flexible(child: Text(t.text, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.text, height: 1.3))),
                            ]),
                          ),
                        ),
                      ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Shown only while the event stream reconnects.
class ReconnectingPill extends StatelessWidget {
  const ReconnectingPill({super.key, required this.visible});
  final bool visible;

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: AnimatedOpacity(
              opacity: visible ? 1 : 0,
              duration: const Duration(milliseconds: 240),
              child: Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(color: const Color(0xFF2A0F33), borderRadius: BorderRadius.circular(99)),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                  SizedBox(width: 8),
                  Text('Reconnecting…', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ),
        ),
      );
}
