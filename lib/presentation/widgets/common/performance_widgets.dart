import 'package:flutter/material.dart';
import '../../../core/theme/design_tokens.dart';

/// Virtualized list for performance with large datasets
class VirtualizedListView<T> extends StatelessWidget {
  final List<T> items;
  final Widget Function(BuildContext, T, int) itemBuilder;
  final double itemExtent;
  final Widget? emptyState;
  final Widget? header;
  final EdgeInsets? padding;
  final ScrollController? controller;

  const VirtualizedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    required this.itemExtent,
    this.emptyState,
    this.header,
    this.padding,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty && emptyState != null) {
      return emptyState!;
    }

    return CustomScrollView(
      controller: controller,
      slivers: [
        if (header != null)
          SliverToBoxAdapter(child: header!),
        SliverFixedExtentList(
          itemExtent: itemExtent,
          delegate: SliverChildBuilderDelegate(
            (context, index) => itemBuilder(context, items[index], index),
            childCount: items.length,
          ),
        ),
      ],
    );
  }
}

/// Paginated data display with load more
class PaginatedListView<T> extends StatefulWidget {
  final List<T> items;
  final Widget Function(BuildContext, T, int) itemBuilder;
  final Future<void> Function()? onLoadMore;
  final bool hasMore;
  final bool isLoading;
  final Widget? emptyState;
  final EdgeInsets? padding;

  const PaginatedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.onLoadMore,
    this.hasMore = false,
    this.isLoading = false,
    this.emptyState,
    this.padding,
  });

  @override
  State<PaginatedListView<T>> createState() => _PaginatedListViewState<T>();
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!widget.hasMore || widget.isLoading) return;
    
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    final threshold = maxScroll * 0.9;
    
    if (currentScroll >= threshold) {
      widget.onLoadMore?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty && !widget.isLoading && widget.emptyState != null) {
      return widget.emptyState!;
    }

    return ListView.builder(
      controller: _scrollController,
      padding: widget.padding,
      itemCount: widget.items.length + (widget.hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= widget.items.length) {
          return _buildLoadingIndicator();
        }
        return widget.itemBuilder(context, widget.items[index], index);
      },
    );
  }

  Widget _buildLoadingIndicator() {
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space16),
      child: Center(
        child: widget.isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : TextButton(
                onPressed: widget.onLoadMore,
                child: const Text('Load more'),
              ),
      ),
    );
  }
}

/// Adaptive grid for responsive layouts
class AdaptiveGrid extends StatelessWidget {
  final List<Widget> children;
  final double minItemWidth;
  final double spacing;
  final double runSpacing;
  final EdgeInsets? padding;

  const AdaptiveGrid({
    super.key,
    required this.children,
    this.minItemWidth = 300,
    this.spacing = DesignTokens.space16,
    this.runSpacing = DesignTokens.space16,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = (constraints.maxWidth / minItemWidth).floor().clamp(1, 4);
        
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: padding,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: spacing,
            mainAxisSpacing: runSpacing,
            childAspectRatio: 1.5,
          ),
          itemCount: children.length,
          itemBuilder: (context, index) => children[index],
        );
      },
    );
  }
}
